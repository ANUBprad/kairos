import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Real-PostgreSQL regression tests for the Round 3/4 reliability findings.
 * They only run against a disposable TEST_DATABASE_URL; production data and
 * DATABASE_URL are never used.
 */
describe("round 3 reliability (integration)", () => {
    if (!process.env.TEST_DATABASE_URL) {
        it("requires TEST_DATABASE_URL", { skip: "TEST_DATABASE_URL not set" }, () => {});
        return;
    }

    const testUrl = process.env.TEST_DATABASE_URL;
    // Services use the global Prisma singleton; point it at the disposable DB
    // before any service module is imported below.
    process.env.DATABASE_URL = testUrl;

    const pool = new Pool({ connectionString: testUrl });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });

    after(async () => {
        await db.$disconnect();
        await pool.end();
    });

    type Fixture = {
        userId: string;
        workspaceId: string;
        conversationId: string;
        artifactId: string;
        sourceId: string;
    };

    async function createFixture(): Promise<Fixture> {
        const fixture: Fixture = {
            userId: `r3-${randomUUID()}`,
            workspaceId: `ws-${randomUUID()}`,
            conversationId: `conv-${randomUUID()}`,
            artifactId: `art-${randomUUID()}`,
            sourceId: `src-${randomUUID()}`,
        };
        await db.user.create({
            data: {
                id: fixture.userId,
                name: "Round 3 test user",
                email: `${fixture.userId}@example.test`,
                credits: 100,
            },
        });
        await db.workspace.create({
            data: {
                id: fixture.workspaceId,
                userId: fixture.userId,
                title: "Round 3 test workspace",
            },
        });
        await db.conversation.create({
            data: { id: fixture.conversationId, workspaceId: fixture.workspaceId },
        });
        await db.learningArtifact.create({
            data: {
                id: fixture.artifactId,
                workspaceId: fixture.workspaceId,
                type: "SUMMARY",
                title: "Round 3 test artifact",
                status: "PENDING",
            },
        });
        await db.source.create({
            data: {
                id: fixture.sourceId,
                workspaceId: fixture.workspaceId,
                type: "TEXT",
                title: "Round 3 test source",
                status: "PROCESSING",
            },
        });
        return fixture;
    }

    async function removeFixture(fixture: Fixture): Promise<void> {
        await db.learningArtifact.deleteMany({ where: { id: fixture.artifactId } });
        await db.source.deleteMany({ where: { id: fixture.sourceId } });
        await db.conversation.deleteMany({ where: { id: fixture.conversationId } });
        await db.workspace.deleteMany({ where: { id: fixture.workspaceId } });
        await db.user.deleteMany({ where: { id: fixture.userId } });
        await db.durableJob.deleteMany({
            where: {
                OR: [
                    { key: `artifact-generate:${fixture.artifactId}` },
                    { key: `source.process:${fixture.sourceId}` },
                ],
            },
        });
    }

    async function addCharge(fixture: Fixture, amount: number, key: string) {
        await db.creditTransaction.create({
            data: {
                userId: fixture.userId,
                amount: -amount,
                balanceAfter: 100 - amount,
                type: "ARTIFACT_GENERATE",
                description: "integration charge",
                idempotencyKey: key,
            },
        });
    }

    it("keeps a retryable job's charge and only refunds when the job is DEAD", async () => {
        const outbox = await import("../lib/outbox.js");
        outbox.setOutboxStoreForTests(db as never);
        const fixture = await createFixture();
        const key = `artifact-generate:${fixture.artifactId}`;
        try {
            await addCharge(fixture, 10, key);
            await db.durableJob.create({
                data: {
                    key,
                    type: "artifact.generate",
                    payload: {
                        artifactId: fixture.artifactId,
                        chargeIdempotencyKey: key,
                    },
                    status: "PROCESSING",
                    attempts: 0,
                    maxAttempts: 2,
                },
            });

            assert.equal(await outbox.releaseDurableJob(key, new Error("transient")), "RETRY");
            assert.equal(
                await db.creditTransaction.count({
                    where: { idempotencyKey: `artifact-refund:${fixture.artifactId}` },
                }),
                0,
            );

            await db.durableJob.updateMany({
                where: { key },
                data: { status: "PROCESSING", attempts: 1 },
            });
            assert.equal(await outbox.releaseDurableJob(key, new Error("fatal")), "DEAD");

            const refunds = await db.creditTransaction.findMany({
                where: { idempotencyKey: `artifact-refund:${fixture.artifactId}` },
            });
            assert.equal(refunds.length, 1);
            const artifact = await db.learningArtifact.findUniqueOrThrow({
                where: { id: fixture.artifactId },
            });
            assert.equal(artifact.status, "FAILED");
            assert.ok(artifact.refundedAt);

            // Repeating compensation must not create a second refund.
            await outbox.releaseDurableJob(key, new Error("again"));
            assert.equal(
                await db.creditTransaction.count({
                    where: { idempotencyKey: `artifact-refund:${fixture.artifactId}` },
                }),
                1,
            );
        } finally {
            await removeFixture(fixture);
        }
    });

    it("never overwrites or refunds a READY source on a late failure", async () => {
        const { markSourceFailed } = await import("../services/source-processing.services.js");
        const outbox = await import("../lib/outbox.js");
        outbox.setOutboxStoreForTests(db as never);
        const fixture = await createFixture();
        const key = `source.process:${fixture.sourceId}`;
        try {
            await db.source.update({
                where: { id: fixture.sourceId },
                data: { status: "READY", content: "completed content" },
            });
            await addCharge(fixture, 5, key);
            await db.durableJob.create({
                data: {
                    key,
                    type: "source.process",
                    payload: { sourceId: fixture.sourceId },
                    status: "DEAD",
                    attempts: 2,
                    maxAttempts: 2,
                },
            });

            await markSourceFailed(fixture.sourceId, new Error("late failure"), {});

            const source = await db.source.findUniqueOrThrow({
                where: { id: fixture.sourceId },
            });
            assert.equal(source.status, "READY");
            assert.equal(source.content, "completed content");
            assert.equal(
                await db.creditTransaction.count({
                    where: { idempotencyKey: `source-refund:${fixture.sourceId}` },
                }),
                0,
            );
        } finally {
            await removeFixture(fixture);
        }
    });

    it("conditionally completes only a PROCESSING source", async () => {
        const repo = await import("../repository/source.repository.js");
        const fixture = await createFixture();
        try {
            const first = await repo.markSourceReadyIfProcessing(fixture.sourceId, {
                indexedAt: "first",
            });
            assert.equal(first?.status, "READY");

            // A stale worker cannot overwrite the completed state.
            const second = await repo.markSourceReadyIfProcessing(fixture.sourceId, {
                indexedAt: "stale",
            });
            assert.equal(second, null);

            const source = await db.source.findUniqueOrThrow({
                where: { id: fixture.sourceId },
            });
            assert.equal(
                (source.metadata as { indexedAt?: string } | null)?.indexedAt,
                "first",
            );
        } finally {
            await removeFixture(fixture);
        }
    });

    it("lets exactly one of two concurrent requests take the last chat quota slot", async () => {
        const { reserveChatMessageInTransaction } = await import("../services/usage.services.js");
        const fixture = await createFixture();
        try {
            // FREE plan allows 10 user messages; prefill 9.
            await db.message.createMany({
                data: Array.from({ length: 9 }, (_, index) => ({
                    conversationId: fixture.conversationId,
                    role: "USER" as const,
                    content: `prefill-${index}`,
                })),
            });

            const results = await Promise.allSettled([
                db.$transaction((tx) =>
                    reserveChatMessageInTransaction(tx, {
                        userId: fixture.userId,
                        conversationId: fixture.conversationId,
                        content: "winner-a",
                    }),
                ),
                db.$transaction((tx) =>
                    reserveChatMessageInTransaction(tx, {
                        userId: fixture.userId,
                        conversationId: fixture.conversationId,
                        content: "winner-b",
                    }),
                ),
            ]);

            assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
            assert.equal(results.filter((result) => result.status === "rejected").length, 1);
            assert.equal(
                await db.message.count({
                    where: { conversationId: fixture.conversationId, role: "USER" },
                }),
                10,
            );
        } finally {
            await removeFixture(fixture);
        }
    });

    it("reuses one message for concurrent retries with the same request key", async () => {
        const { reserveChatMessageInTransaction } = await import("../services/usage.services.js");
        const fixture = await createFixture();
        try {
            const requestKey = `req-${randomUUID()}`;
            const results = await Promise.all([
                db.$transaction((tx) =>
                    reserveChatMessageInTransaction(tx, {
                        userId: fixture.userId,
                        conversationId: fixture.conversationId,
                        content: "idempotent",
                        requestKey,
                    }),
                ),
                db.$transaction((tx) =>
                    reserveChatMessageInTransaction(tx, {
                        userId: fixture.userId,
                        conversationId: fixture.conversationId,
                        content: "idempotent",
                        requestKey,
                    }),
                ),
            ]);

            assert.equal(results.filter((result) => result.created).length, 1);
            assert.equal(results[0].message.id, results[1].message.id);
            assert.equal(
                await db.message.count({
                    where: { conversationId: fixture.conversationId, role: "USER" },
                }),
                1,
            );
        } finally {
            await removeFixture(fixture);
        }
    });

    it("rejects stale lease completion but allows renewal by the live holder", async () => {
        const repo = await import("../repository/artifact.repository.js");
        const fixture = await createFixture();
        try {
            assert.equal(
                await repo.claimArtifactForProcessing(fixture.artifactId, "worker-1", 1),
                true,
            );
            // Force the lease into the past to simulate an expired worker.
            await db.learningArtifact.update({
                where: { id: fixture.artifactId },
                data: { leaseExpiresAt: new Date(Date.now() - 1000) },
            });
            assert.equal(
                await repo.completeArtifactProcessing(fixture.artifactId, "worker-1", {
                    content: { stale: true },
                }),
                false,
            );
            assert.equal(
                await repo.renewArtifactLease(fixture.artifactId, "worker-1", 60_000),
                false,
            );

            // An expired lease is recovered by the stale sweep and an explicit
            // retry before another worker may claim the row.
            assert.equal(
                await repo.markArtifactFailedIfEligible(
                    fixture.artifactId,
                    null,
                    "stale sweep",
                ),
                true,
            );
            assert.equal(
                await repo.markArtifactPendingForRetry(fixture.artifactId),
                true,
            );
            assert.equal(
                await repo.claimArtifactForProcessing(fixture.artifactId, "worker-2", 60_000),
                true,
            );
            assert.equal(
                await repo.renewArtifactLease(fixture.artifactId, "worker-2", 60_000),
                true,
            );
            assert.equal(
                await repo.completeArtifactProcessing(fixture.artifactId, "worker-2", {
                    content: { final: true },
                }),
                true,
            );

            const artifact = await db.learningArtifact.findUniqueOrThrow({
                where: { id: fixture.artifactId },
            });
            assert.equal(artifact.status, "READY");
            assert.equal((artifact.content as { final?: boolean } | null)?.final, true);
        } finally {
            await removeFixture(fixture);
        }
    });

    it("grants the signup bonus once under concurrent hook invocations", async () => {
        const { grantSignupCreditsForUser } = await import("../lib/signup-credits.js");
        const fixture = await createFixture();
        try {
            await db.user.update({
                where: { id: fixture.userId },
                data: { credits: 0 },
            });
            await Promise.all([
                grantSignupCreditsForUser({ id: fixture.userId }),
                grantSignupCreditsForUser({ id: fixture.userId }),
            ]);

            const user = await db.user.findUniqueOrThrow({
                where: { id: fixture.userId },
            });
            assert.equal(user.credits, 50);
            assert.equal(
                await db.creditTransaction.count({
                    where: { idempotencyKey: `signup-credit:${fixture.userId}` },
                }),
                1,
            );
        } finally {
            await removeFixture(fixture);
        }
    });

    it("refuses to retry a terminal failure that was already refunded", async () => {
        const { retryArtifactForWorkspace } = await import("../services/artifact.services.js");
        const fixture = await createFixture();
        try {
            await db.learningArtifact.update({
                where: { id: fixture.artifactId },
                data: { status: "FAILED", refundedAt: new Date() },
            });

            await assert.rejects(
                retryArtifactForWorkspace(
                    fixture.workspaceId,
                    fixture.artifactId,
                    fixture.userId,
                ),
                /refunded after a terminal failure/,
            );

            const artifact = await db.learningArtifact.findUniqueOrThrow({
                where: { id: fixture.artifactId },
            });
            assert.equal(artifact.status, "FAILED");
        } finally {
            await removeFixture(fixture);
        }
    });
});
