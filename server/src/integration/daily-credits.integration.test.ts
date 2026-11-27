import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Real-PostgreSQL regressions for six-hour UTC credit windows. They only run
 * against the disposable test database supplied through TEST_DATABASE_URL.
 * All identities are synthetic; no environment values are logged.
 */
describe("six-hour credit windows (integration)", () => {
    if (!process.env.TEST_DATABASE_URL) {
        it("requires TEST_DATABASE_URL", { skip: "TEST_DATABASE_URL not set" }, () => {});
        return;
    }

    const testUrl = process.env.TEST_DATABASE_URL;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalDeveloperEmails = process.env.DEVELOPER_EMAILS;
    process.env.DATABASE_URL = testUrl;

    const pool = new Pool({ connectionString: testUrl });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });

    after(async () => {
        if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = originalDatabaseUrl;
        if (originalDeveloperEmails === undefined) delete process.env.DEVELOPER_EMAILS;
        else process.env.DEVELOPER_EMAILS = originalDeveloperEmails;
        await db.$disconnect();
        await pool.end();
    });

    const boundaries = [
        "2026-11-28T00:00:00.000Z",
        "2026-11-28T06:00:00.000Z",
        "2026-11-28T12:00:00.000Z",
        "2026-11-28T18:00:00.000Z",
    ];

    for (const boundary of boundaries) {
        it(`rolls a legacy balance into the ${boundary} window once, preserving paid credits`, async () => {
            const credits = await import("../services/credit.services.js");
            const userId = `daily-window-${randomUUID()}`;
            await db.user.create({
                data: {
                    id: userId,
                    name: "Window test user",
                    email: `${userId}@example.test`,
                    credits: 275,
                    dailyCredits: 12,
                    dailyCreditDay: "1970-01-01",
                },
            });

            try {
                const snapshot = await db.$transaction((tx) =>
                    credits.ensureDailyCreditsInTransaction(tx, userId, new Date(boundary)),
                );

                assert.equal(snapshot.dailyCredits, 100);
                assert.equal(snapshot.paidCredits, 275);
                assert.equal(snapshot.credits, 375);
                assert.equal(snapshot.dailyCreditDay, boundary);
                assert.equal(snapshot.creditWindowStart, boundary);
                assert.equal(snapshot.nextCreditResetAt, credits.getNextUtcCreditReset(new Date(boundary)));
                assert.equal(snapshot.windowAllowance, 100);
                assert.equal(snapshot.windowsPerDay, 4);

                const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
                assert.equal(user.dailyCredits, 100);
                assert.equal(user.credits, 275);
                assert.equal(user.dailyCreditDay, boundary);

                const grants = await db.creditTransaction.findMany({
                    where: { userId, type: "DAILY_ALLOWANCE" },
                });
                assert.equal(grants.length, 1);
                assert.equal(grants[0]!.amount, 88);
                assert.equal(grants[0]!.idempotencyKey, `daily-reset:${userId}:${boundary}`);
                const metadata = grants[0]!.metadata as Record<string, unknown>;
                assert.equal(metadata.creditWindowStart, boundary);
                assert.equal(metadata.dailyCreditDay, boundary);
                assert.equal(metadata.windowAllowance, 100);
            } finally {
                await db.user.deleteMany({ where: { id: userId } });
            }
        });
    }

    it("grants exactly one allowance under concurrent boundary rollover", async () => {
        const credits = await import("../services/credit.services.js");
        const userId = `daily-concurrent-${randomUUID()}`;
        await db.user.create({
            data: {
                id: userId,
                name: "Concurrent window user",
                email: `${userId}@example.test`,
                credits: 40,
                dailyCredits: 3,
                dailyCreditDay: "1970-01-01",
            },
        });
        const boundary = new Date("2026-11-28T18:00:00.000Z");

        try {
            const snapshots = await Promise.all(
                [0, 1, 2, 3].map(() =>
                    db.$transaction((tx) =>
                        credits.ensureDailyCreditsInTransaction(tx, userId, boundary),
                    ),
                ),
            );

            for (const snapshot of snapshots) {
                assert.equal(snapshot.dailyCredits, 100);
                assert.equal(snapshot.paidCredits, 40);
                assert.equal(snapshot.creditWindowStart, boundary.toISOString());
            }

            const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
            assert.equal(user.dailyCredits, 100);
            assert.equal(user.credits, 40);
            assert.equal(
                await db.creditTransaction.count({
                    where: { userId, type: "DAILY_ALLOWANCE" },
                }),
                1,
            );
        } finally {
            await db.user.deleteMany({ where: { id: userId } });
        }
    });

    it("spends daily credits before paid credits and refunds both within one window", async () => {
        const credits = await import("../services/credit.services.js");
        const userId = `daily-refund-${randomUUID()}`;
        const now = new Date("2026-11-28T12:05:00.000Z");
        const windowStart = credits.getUtcCreditWindowStart(now);
        await db.user.create({
            data: {
                id: userId,
                name: "Window refund user",
                email: `${userId}@example.test`,
                credits: 20,
                dailyCredits: 3,
                dailyCreditDay: windowStart,
            },
        });

        const chargeKey = `daily-window-charge:${userId}`;
        const refundKey = `daily-window-refund:${userId}`;
        try {
            const charged = await db.$transaction((tx) =>
                credits.debitCreditsInTransaction(
                    tx,
                    {
                        userId,
                        amount: 5,
                        type: "ARTIFACT_GENERATE",
                        description: "integration split charge",
                        idempotencyKey: chargeKey,
                    },
                    now,
                ),
            );
            assert.equal(charged.snapshot.dailyCredits, 0);
            assert.equal(charged.snapshot.paidCredits, 18);

            const charge = await db.creditTransaction.findUniqueOrThrow({
                where: { idempotencyKey: chargeKey },
            });
            assert.equal(charge.bucket, "MIXED");
            assert.equal(charge.dailyAmount, 3);
            assert.equal(charge.paidAmount, 2);
            assert.equal(
                (charge.metadata as Record<string, unknown>).creditWindowStart,
                windowStart,
            );

            await db.$transaction((tx) =>
                credits.refundChargeInTransaction(
                    tx,
                    {
                        chargeIdempotencyKey: chargeKey,
                        refundIdempotencyKey: refundKey,
                        expectedUserId: userId,
                        reason: "integration failure",
                    },
                    now,
                ),
            );

            const refunded = await db.user.findUniqueOrThrow({ where: { id: userId } });
            assert.equal(refunded.dailyCredits, 3);
            assert.equal(refunded.credits, 20);
            assert.equal(
                await db.creditTransaction.count({ where: { idempotencyKey: refundKey } }),
                1,
            );
        } finally {
            await db.user.deleteMany({ where: { id: userId } });
        }
    });

    it("moves an expired daily refund to paid credits across a window boundary, exactly once", async () => {
        const credits = await import("../services/credit.services.js");
        const userId = `daily-boundary-refund-${randomUUID()}`;
        const now = new Date("2026-11-28T18:05:00.000Z");
        const previousWindow = "2026-11-28T12:00:00.000Z";
        await db.user.create({
            data: {
                id: userId,
                name: "Boundary refund user",
                email: `${userId}@example.test`,
                credits: 20,
                dailyCredits: 0,
                dailyCreditDay: credits.getUtcCreditWindowStart(now),
            },
        });
        const chargeKey = `daily-boundary-charge:${userId}`;
        const refundKey = `daily-boundary-refund:${userId}`;

        try {
            await db.creditTransaction.create({
                data: {
                    userId,
                    amount: -5,
                    balanceAfter: 15,
                    type: "ARTIFACT_GENERATE",
                    description: "charge from the previous window",
                    bucket: "MIXED",
                    dailyAmount: 3,
                    paidAmount: 2,
                    balanceAfterDaily: 0,
                    balanceAfterPaid: 18,
                    metadata: {
                        creditWindowStart: previousWindow,
                        dailyCreditDay: previousWindow,
                    },
                    idempotencyKey: chargeKey,
                },
            });

            const input = {
                chargeIdempotencyKey: chargeKey,
                refundIdempotencyKey: refundKey,
                expectedUserId: userId,
                reason: "window expired",
            };
            assert.equal(
                await db.$transaction((tx) =>
                    credits.refundChargeInTransaction(tx, input, now),
                ),
                true,
            );
            assert.equal(
                await db.$transaction((tx) =>
                    credits.refundChargeInTransaction(tx, input, now),
                ),
                true,
            );

            const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
            assert.equal(user.dailyCredits, 0);
            assert.equal(user.credits, 25);
            const refunds = await db.creditTransaction.findMany({
                where: { idempotencyKey: refundKey },
            });
            assert.equal(refunds.length, 1);
            assert.equal(refunds[0]!.dailyAmount, 0);
            assert.equal(refunds[0]!.paidAmount, 5);
        } finally {
            await db.user.deleteMany({ where: { id: userId } });
        }
    });

    it("lets an allowlisted developer bypass credits and FREE quotas without a ledger entry", async () => {
        const credits = await import("../services/credit.services.js");
        const usage = await import("../services/usage.services.js");
        const developer = await import("../lib/developer.js");
        const developerUserId = `developer-${randomUUID()}`;
        const regularUserId = `regular-${randomUUID()}`;
        const now = new Date("2026-11-28T18:00:00.000Z");

        // Synthetic-only allowlist value; restored in the suite's after hook.
        process.env.DEVELOPER_EMAILS = "developer@example.test";

        await db.user.create({
            data: {
                id: developerUserId,
                name: "Developer test user",
                email: "developer@example.test",
                credits: 1,
                dailyCredits: 0,
                dailyCreditDay: "1970-01-01",
                plan: "FREE",
                totalArtifactsCreated: 3,
            },
        });
        await db.user.create({
            data: {
                id: regularUserId,
                name: "Regular test user",
                email: `${regularUserId}@example.test`,
                credits: 10,
                dailyCredits: 0,
                dailyCreditDay: credits.getUtcCreditWindowStart(now),
                plan: "FREE",
                totalArtifactsCreated: 3,
            },
        });

        try {
            assert.equal(await developer.isDeveloperUser(developerUserId), true);
            assert.equal(await developer.isDeveloperUser(regularUserId), false);

            const developerCharge = {
                userId: developerUserId,
                amount: 500,
                type: "ARTIFACT_GENERATE" as const,
                description: "developer work",
                idempotencyKey: `developer-charge:${developerUserId}`,
                // A client flag must not affect the server decision.
                isDeveloper: false,
            };
            const result = await db.$transaction((tx) =>
                credits.debitCreditsInTransaction(tx, developerCharge, now),
            );
            assert.equal(result.success, true);
            assert.equal(result.snapshot.credits, 1);
            assert.equal(
                await db.creditTransaction.count({ where: { userId: developerUserId } }),
                0,
            );
            const unchanged = await db.user.findUniqueOrThrow({
                where: { id: developerUserId },
            });
            assert.equal(unchanged.credits, 1);
            assert.equal(unchanged.dailyCredits, 0);

            await db.$transaction((tx) =>
                usage.assertQuotaInTransaction(tx, developerUserId, "artifacts"),
            );
            await db.$transaction((tx) =>
                usage.consumeArtifactQuotaInTransaction(tx, developerUserId),
            );
            const afterQuota = await db.user.findUniqueOrThrow({
                where: { id: developerUserId },
            });
            assert.equal(afterQuota.totalArtifactsCreated, 4);

            await assert.rejects(
                db.$transaction((tx) =>
                    credits.debitCreditsInTransaction(
                        tx,
                        {
                            userId: regularUserId,
                            amount: 11,
                            type: "ARTIFACT_GENERATE",
                            description: "regular user work",
                            idempotencyKey: `regular-charge:${regularUserId}`,
                        },
                        now,
                    ),
                ),
                /Insufficient credits/,
            );
            await assert.rejects(
                db.$transaction((tx) =>
                    usage.assertQuotaInTransaction(tx, regularUserId, "artifacts"),
                ),
                /limit reached/i,
            );
            assert.equal(
                await db.creditTransaction.count({ where: { userId: regularUserId } }),
                0,
            );
        } finally {
            await db.user.deleteMany({
                where: { id: { in: [developerUserId, regularUserId] } },
            });
        }
    });
});
