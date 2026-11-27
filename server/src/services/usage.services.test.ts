import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import type { CreditSnapshot } from "./credit.services.js";
import { CREDIT_COSTS } from "./credit.services.js";
import {
    PLAN_LIMITS,
    assertCanCreateWorkspace,
    assertQuotaInTransaction,
    consumeArtifactQuotaInTransaction,
    getArtifactCharge,
    getUserPlan,
    getUserUsage,
    reserveChatMessageInTransaction,
} from "./usage.services.js";
import { ForbiddenError } from "../types/app-error.js";

const ORIGINAL_DEVELOPER_EMAILS = process.env.DEVELOPER_EMAILS;

async function withDeveloperEmails<T>(
    value: string | undefined,
    fn: () => T | Promise<T>,
): Promise<T> {
    const previous = process.env.DEVELOPER_EMAILS;
    if (value === undefined) delete process.env.DEVELOPER_EMAILS;
    else process.env.DEVELOPER_EMAILS = value;
    try {
        return await fn();
    } finally {
        if (previous === undefined) delete process.env.DEVELOPER_EMAILS;
        else process.env.DEVELOPER_EMAILS = previous;
    }
}

after(() => {
    if (ORIGINAL_DEVELOPER_EMAILS === undefined) delete process.env.DEVELOPER_EMAILS;
    else process.env.DEVELOPER_EMAILS = ORIGINAL_DEVELOPER_EMAILS;
});

type QuotaState = {
    email: string | null;
    plan: "FREE" | "PRO" | "PRO_PLUS";
    totalArtifactsCreated: number;
    sourceCount: number;
    messageCount: number;
};

function quotaTx(options: Partial<QuotaState> = {}) {
    const state: QuotaState = {
        email: options.email ?? "regular@example.test",
        plan: options.plan ?? "FREE",
        totalArtifactsCreated: options.totalArtifactsCreated ?? 0,
        sourceCount: options.sourceCount ?? 0,
        messageCount: options.messageCount ?? 0,
    };
    const messages = new Map<string, Record<string, unknown>>();
    const reads: Array<Record<string, unknown>> = [];

    const client = {
        user: {
            findUnique: async ({
                select,
            }: {
                where: { id: string };
                select?: Record<string, unknown>;
            }) => {
                reads.push(select ?? {});
                if (select && Object.keys(select).length === 1 && "email" in select) {
                    return state.email === null ? null : { email: state.email };
                }
                return {
                    plan: state.plan,
                    planExpiresAt: null,
                    totalArtifactsCreated: state.totalArtifactsCreated,
                };
            },
            updateMany: async ({
                where,
                data,
            }: {
                where: { id: string; totalArtifactsCreated?: { lt?: number } };
                data: { totalArtifactsCreated?: { increment?: number } };
            }) => {
                const ceiling = where.totalArtifactsCreated?.lt;
                if (ceiling !== undefined && state.totalArtifactsCreated >= ceiling) {
                    return { count: 0 };
                }
                state.totalArtifactsCreated += data.totalArtifactsCreated?.increment ?? 0;
                return { count: 1 };
            },
        },
        source: { count: async () => state.sourceCount },
        message: {
            count: async () => state.messageCount,
            findUnique: async ({ where }: { where: { requestKey?: string } }) =>
                (where.requestKey ? messages.get(where.requestKey) : undefined) ?? null,
            createMany: async ({
                data,
                skipDuplicates,
            }: {
                data: Array<{ requestKey?: string; content: string }>;
                skipDuplicates?: boolean;
            }) => {
                let count = 0;
                for (const row of data) {
                    if (row.requestKey && messages.has(row.requestKey)) {
                        if (skipDuplicates) continue;
                        throw new Error("duplicate request key");
                    }
                    const id = `message-${messages.size + 1}`;
                    messages.set(row.requestKey ?? id, { id, ...row });
                    count += 1;
                }
                return { count };
            },
            findUniqueOrThrow: async ({ where }: { where: { requestKey: string } }) => {
                const found = messages.get(where.requestKey);
                if (!found) throw new Error("message missing");
                return found;
            },
        },
    };
    return {
        tx: client as unknown as Prisma.TransactionClient,
        state,
        reads,
        messages,
    };
}

function snapshot(overrides: Partial<CreditSnapshot> = {}): CreditSnapshot {
    return {
        credits: 100,
        dailyCredits: 100,
        paidCredits: 0,
        dailyAllowance: 100,
        dailyCreditDay: "2026-11-28T12:00:00.000Z",
        nextDailyResetAt: "2026-11-28T18:00:00.000Z",
        serverTime: "2026-11-28T12:01:00.000Z",
        creditWindowStart: "2026-11-28T12:00:00.000Z",
        nextCreditResetAt: "2026-11-28T18:00:00.000Z",
        windowAllowance: 100,
        windowsPerDay: 4,
        ...overrides,
    };
}

const injectedPlan = {
    id: "u1",
    name: "Injected User",
    email: "regular@example.test",
    plan: "FREE" as const,
    planExpiresAt: null,
    totalArtifactsCreated: 99,
};

describe("action credit pricing", () => {
    it("uses the server-owned cost caps", () => {
        assert.equal(CREDIT_COSTS.SOURCE_UPLOAD, 1);
        assert.equal(CREDIT_COSTS.CHAT_MESSAGE, 1);
        assert.equal(CREDIT_COSTS.ARTIFACT_GENERATE, 3);
        assert.equal(CREDIT_COSTS.ARTIFACT_COMPUTE, 5);
        assert.equal(CREDIT_COSTS.AUDIO_DEBATE, 10);
    });

    it("charges five credits only for compute-heavy artifacts", () => {
        for (const type of ["MINDMAP", "DIAGRAM", "REPORT"]) {
            const charge = getArtifactCharge(type);
            assert.equal(charge.cost, 5, `${type} cost`);
            assert.equal(charge.type, "ARTIFACT_GENERATE");
        }
    });

    it("charges three credits for standard artifacts", () => {
        for (const type of ["SUMMARY", "FLASHCARDS", "QUIZ", "TAKEAWAYS", undefined]) {
            const charge = getArtifactCharge(type);
            assert.equal(charge.cost, 3, `${type ?? "default"} cost`);
            assert.equal(charge.type, "ARTIFACT_GENERATE");
        }
    });

    it("charges ten credits for an audio debate podcast", () => {
        const charge = getArtifactCharge("PODCAST");
        assert.equal(charge.cost, 10);
        assert.equal(charge.type, "AUDIO_DEBATE");
    });
});

describe("developer quota entitlement", () => {
    it("exposes developer entitlement without faking the stored plan", async () => {
        const developer = await getUserPlan("u1", {
            isDeveloper: true,
            planDetails: injectedPlan,
        });
        assert.equal(developer.plan, "FREE");
        assert.equal(developer.subscriptionPlan, "FREE");
        assert.equal(developer.isDeveloper, true);
        assert.equal(developer.developer, true);
        assert.deepEqual(developer.entitlement, {
            developer: true,
            bypassCredits: true,
            bypassFreeQuotas: true,
        });
        assert.equal(developer.limits.WORKSPACES, null);
        assert.equal(developer.limits.SOURCES, null);
        assert.equal(developer.limits.ARTIFACTS, null);
        assert.equal(developer.limits.MESSAGES, null);

        const regular = await getUserPlan("u1", {
            isDeveloper: false,
            planDetails: injectedPlan,
        });
        assert.equal(regular.isDeveloper, false);
        assert.equal(regular.developer, false);
        assert.deepEqual(regular.entitlement, {
            developer: false,
            bypassCredits: false,
            bypassFreeQuotas: false,
        });
        assert.deepEqual(regular.limits, PLAN_LIMITS.FREE);
    });

    it("keeps real usage counts while reporting unlimited developer limits", async () => {
        const options = {
            isDeveloper: true,
            planDetails: injectedPlan,
            workspaceCount: 7,
            sourceCount: 12,
            totalArtifactsCreated: 21,
            messageCount: 40,
            creditSnapshot: snapshot(),
            creditHistory: [],
        };
        const usage = await getUserUsage("u1", options);

        assert.equal(usage.isDeveloper, true);
        assert.equal(usage.developer, true);
        assert.deepEqual(usage.entitlement, {
            developer: true,
            bypassCredits: true,
            bypassFreeQuotas: true,
        });
        assert.equal(usage.plan, "FREE");
        assert.equal(usage.workspaces.count, 7);
        assert.equal(usage.workspaces.limit, null);
        assert.equal(usage.workspaces.exceeded, false);
        assert.equal(usage.sources.count, 12);
        assert.equal(usage.artifacts.count, 21);
        assert.equal(usage.messages.count, 40);
        assert.equal(usage.creditWindowStart, "2026-11-28T12:00:00.000Z");
        assert.equal(usage.windowsPerDay, 4);
    });

    it("still reports plan limits and exceeded flags for non-developers", async () => {
        const usage = await getUserUsage("u1", {
            isDeveloper: false,
            planDetails: injectedPlan,
            workspaceCount: 2,
            sourceCount: 4,
            totalArtifactsCreated: 3,
            messageCount: 11,
            creditSnapshot: snapshot(),
            creditHistory: [],
        });

        assert.equal(usage.isDeveloper, false);
        assert.equal(usage.workspaces.limit, 1);
        assert.equal(usage.workspaces.exceeded, true);
        assert.equal(usage.sources.limit, 3);
        assert.equal(usage.artifacts.limit, 3);
        assert.equal(usage.artifacts.exceeded, true);
        assert.equal(usage.messages.limit, 10);
        assert.equal(usage.messages.exceeded, true);
    });

    it("bypasses transactional artifact and message quotas only for allowlisted emails", async () => {
        await withDeveloperEmails("Developer@Example.test", async () => {
            const developer = quotaTx({
                email: "DEVELOPER@example.test",
                totalArtifactsCreated: PLAN_LIMITS.FREE.ARTIFACTS,
                sourceCount: PLAN_LIMITS.FREE.SOURCES,
                messageCount: PLAN_LIMITS.FREE.MESSAGES!,
            });

            await assertQuotaInTransaction(developer.tx, "u1", "artifacts");
            await assertQuotaInTransaction(developer.tx, "u1", "sources");
            await assertQuotaInTransaction(developer.tx, "u1", "messages");
            await consumeArtifactQuotaInTransaction(developer.tx, "u1");
            assert.equal(developer.state.totalArtifactsCreated, PLAN_LIMITS.FREE.ARTIFACTS + 1);
            assert.deepEqual(developer.reads[0], { email: true });
        });

        const regular = quotaTx({
            totalArtifactsCreated: PLAN_LIMITS.FREE.ARTIFACTS,
            sourceCount: PLAN_LIMITS.FREE.SOURCES,
            messageCount: PLAN_LIMITS.FREE.MESSAGES!,
        });
        for (const limitType of ["artifacts", "sources", "messages"] as const) {
            await assert.rejects(
                assertQuotaInTransaction(regular.tx, "u1", limitType),
                (error: unknown) => {
                    assert.ok(error instanceof ForbiddenError);
                    assert.equal(
                        (error.details as Record<string, unknown>).code,
                        "LIMIT_REACHED",
                    );
                    return true;
                },
            );
        }
        await assert.rejects(
            consumeArtifactQuotaInTransaction(regular.tx, "u1"),
            /limit reached/i,
        );
        assert.equal(regular.state.totalArtifactsCreated, PLAN_LIMITS.FREE.ARTIFACTS);
    });

    it("ignores a client-provided developer flag when enforcing quotas", async () => {
        await withDeveloperEmails("developer@example.test", async () => {
            const regular = quotaTx({
                email: "regular@example.test",
                totalArtifactsCreated: PLAN_LIMITS.FREE.ARTIFACTS,
            });
            await assert.rejects(
                assertQuotaInTransaction(regular.tx, "u1", "artifacts"),
                /limit reached/i,
            );
        });
    });

    it("bypasses workspace limits for developers but not for regular users", async () => {
        await withDeveloperEmails("developer@example.test", async () => {
            await assertCanCreateWorkspace("u1", {
                isDeveloper: true,
                planDetails: injectedPlan,
                workspaceCount: 50,
            });
        });

        await assert.rejects(
            assertCanCreateWorkspace("u1", {
                isDeveloper: false,
                planDetails: injectedPlan,
                workspaceCount: 1,
            }),
            (error: unknown) => {
                assert.ok(error instanceof ForbiddenError);
                assert.equal(
                    (error.details as Record<string, unknown>).limitType,
                    "workspaces",
                );
                return true;
            },
        );
    });

    it("keeps request-key reservation idempotent while bypassing chat quotas", async () => {
        await withDeveloperEmails("developer@example.test", async () => {
            const developer = quotaTx({
                email: "developer@example.test",
                messageCount: PLAN_LIMITS.FREE.MESSAGES!,
            });
            const input = {
                userId: "u1",
                conversationId: "c1",
                content: "hello",
                requestKey: "chat-request-1",
                // Client flags are not part of the reservation contract.
                isDeveloper: false,
            };

            const first = await reserveChatMessageInTransaction(developer.tx, input as never);
            const retry = await reserveChatMessageInTransaction(developer.tx, input as never);

            assert.equal(first.created, true);
            assert.equal(retry.created, false);
            assert.deepEqual(retry.message, first.message);
            assert.equal(developer.messages.size, 1);
        });

        const regular = quotaTx({ messageCount: PLAN_LIMITS.FREE.MESSAGES! });
        await assert.rejects(
            reserveChatMessageInTransaction(regular.tx, {
                userId: "u1",
                conversationId: "c1",
                content: "blocked",
                requestKey: "chat-request-2",
            }),
            /limit reached/i,
        );
    });
});
