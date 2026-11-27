import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Real-PostgreSQL daily allowance regressions. They only run against the
 * disposable test database supplied through TEST_DATABASE_URL.
 */
describe("daily credits (integration)", () => {
    if (!process.env.TEST_DATABASE_URL) {
        it("requires TEST_DATABASE_URL", { skip: "TEST_DATABASE_URL not set" }, () => {});
        return;
    }

    const testUrl = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = testUrl;

    const pool = new Pool({ connectionString: testUrl });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });

    after(async () => {
        await db.$disconnect();
        await pool.end();
    });

    it("grants exactly one 100-credit allowance under concurrent rollover", async () => {
        const credits = await import("../services/credit.services.js");
        const userId = `daily-${randomUUID()}`;
        await db.user.create({
            data: {
                id: userId,
                name: "Daily credits test user",
                email: `${userId}@example.test`,
                credits: 275,
                dailyCredits: 12,
                dailyCreditDay: "1970-01-01",
            },
        });

        try {
            const snapshots = await Promise.all([
                credits.getCreditSnapshot(userId),
                credits.getCreditSnapshot(userId),
                credits.getCreditSnapshot(userId),
            ]);

            for (const snapshot of snapshots) {
                assert.equal(snapshot.dailyCredits, 100);
                assert.equal(snapshot.paidCredits, 275);
                assert.equal(snapshot.dailyAllowance, 100);
                assert.ok(snapshot.nextDailyResetAt.endsWith("T00:00:00.000Z"));
            }

            const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
            assert.equal(user.dailyCredits, 100);
            assert.equal(user.credits, 275);

            const grants = await db.creditTransaction.findMany({
                where: { userId, type: "DAILY_ALLOWANCE" },
            });
            assert.equal(grants.length, 1);
            assert.equal(grants[0]!.amount, 88);
        } finally {
            await db.user.deleteMany({ where: { id: userId } });
        }
    });

    it("spends daily credits before paid credits and refunds both buckets once", async () => {
        const credits = await import("../services/credit.services.js");
        const userId = `daily-refund-${randomUUID()}`;
        await db.user.create({
            data: {
                id: userId,
                name: "Daily refund test user",
                email: `${userId}@example.test`,
                credits: 20,
                dailyCredits: 3,
                dailyCreditDay: credits.getUtcCreditDay(),
            },
        });

        const chargeKey = `daily-test-charge:${userId}`;
        try {
            const charged = await db.$transaction((tx) =>
                credits.debitCreditsInTransaction(tx, {
                    userId,
                    amount: 5,
                    type: "ARTIFACT_GENERATE",
                    description: "integration split charge",
                    idempotencyKey: chargeKey,
                }),
            );
            assert.equal(charged.snapshot.dailyCredits, 0);
            assert.equal(charged.snapshot.paidCredits, 18);

            const charge = await db.creditTransaction.findUniqueOrThrow({
                where: { idempotencyKey: chargeKey },
            });
            assert.equal(charge.bucket, "MIXED");
            assert.equal(charge.dailyAmount, 3);
            assert.equal(charge.paidAmount, 2);

            await db.$transaction((tx) =>
                credits.refundChargeInTransaction(tx, {
                    chargeIdempotencyKey: chargeKey,
                    refundIdempotencyKey: `daily-test-refund:${userId}`,
                    expectedUserId: userId,
                    reason: "integration failure",
                }),
            );

            const refunded = await db.user.findUniqueOrThrow({ where: { id: userId } });
            assert.equal(refunded.dailyCredits, 3);
            assert.equal(refunded.credits, 20);
            assert.equal(
                await db.creditTransaction.count({
                    where: { idempotencyKey: `daily-test-refund:${userId}` },
                }),
                1,
            );
        } finally {
            await db.user.deleteMany({ where: { id: userId } });
        }
    });
});
