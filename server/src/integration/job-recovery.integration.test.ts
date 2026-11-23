import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Real-PostgreSQL background-job recovery tests.
 *
 * These exercise the durable outbox state machine, bounded sweep recovery,
 * stale-lease takeover, poison-job compensation and duplicate-delivery safety
 * against a disposable TEST_DATABASE_URL. No provider credentials or live
 * Inngest connection are used: with no Inngest configuration the dispatcher
 * falls back to local workers, and jobs intentionally reference nonexistent
 * resources so no external side effect can occur.
 */
describe("background job recovery (integration)", () => {
    if (!process.env.TEST_DATABASE_URL) {
        it("requires TEST_DATABASE_URL", { skip: "TEST_DATABASE_URL not set" }, () => {});
        return;
    }

    const testUrl = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = testUrl;
    process.env.NODE_ENV = "test";
    // Force the deterministic no-Inngest path: dispatch uses the local worker,
    // which fails fast for our nonexistent fixture ids.
    for (const key of [
        "INNGEST_USE_CLOUD",
        "INNGEST_DEV",
        "INNGEST_EVENT_KEY",
        "INNGEST_SIGNING_KEY",
    ]) {
        delete process.env[key];
    }

    const pool = new Pool({ connectionString: testUrl });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });

    type Fixture = {
        userId: string;
        workspaceId: string;
        artifactId: string;
        sourceId: string;
    };

    const keysToClean = new Set<string>();
    const fixtures: Fixture[] = [];

    async function createFixture(): Promise<Fixture> {
        const fixture: Fixture = {
            userId: `jr-user-${randomUUID()}`,
            workspaceId: `jr-ws-${randomUUID()}`,
            artifactId: `jr-art-${randomUUID()}`,
            sourceId: `jr-src-${randomUUID()}`,
        };
        await db.user.create({
            data: {
                id: fixture.userId,
                name: "Job recovery test user",
                email: `${fixture.userId}@example.test`,
                credits: 100,
            },
        });
        await db.workspace.create({
            data: {
                id: fixture.workspaceId,
                userId: fixture.userId,
                title: "Job recovery test workspace",
            },
        });
        await db.learningArtifact.create({
            data: {
                id: fixture.artifactId,
                workspaceId: fixture.workspaceId,
                type: "SUMMARY",
                title: "Job recovery artifact",
                status: "PENDING",
            },
        });
        await db.source.create({
            data: {
                id: fixture.sourceId,
                workspaceId: fixture.workspaceId,
                type: "TEXT",
                title: "Job recovery source",
                status: "PROCESSING",
            },
        });
        fixtures.push(fixture);
        return fixture;
    }

    async function insertJobs(
        count: number,
        input: {
            type?: "artifact.generate" | "source.process";
            status?: "PENDING" | "PROCESSING";
            maxAttempts?: number;
            availableAt?: Date;
            resourceId?: string;
        } = {},
    ): Promise<string[]> {
        const runId = randomUUID();
        const keys = Array.from(
            { length: count },
            (_, i) => `jr-${runId}-${String(i).padStart(4, "0")}`,
        );
        const type = input.type ?? "artifact.generate";
        await db.durableJob.createMany({
            data: keys.map((key) => ({
                key,
                type,
                payload:
                    type === "artifact.generate"
                        ? { artifactId: input.resourceId ?? `missing-${key}` }
                        : { sourceId: input.resourceId ?? `missing-${key}` },
                status: input.status ?? "PENDING",
                attempts: 0,
                maxAttempts: input.maxAttempts ?? 5,
                availableAt: input.availableAt ?? new Date(),
            })),
        });
        keys.forEach((key) => keysToClean.add(key));
        return keys;
    }

    async function ageProcessingJob(key: string, minutes = 20): Promise<void> {
        // Prisma overrides @updatedAt on updates, so use the mapped table name
        // to simulate a worker that crashed minutes ago.
        await db.$executeRawUnsafe(
            `UPDATE durable_job SET "updatedAt" = NOW() - ($1::int || ' minutes')::interval WHERE key = $2`,
            minutes,
            key,
        );
    }

    before(async () => {
        const outbox = await import("../lib/outbox.js");
        outbox.setOutboxStoreForTests(db as never);
    });

    after(async () => {
        if (keysToClean.size) {
            await db.durableJob.deleteMany({ where: { key: { in: [...keysToClean] } } });
        }
        for (const fixture of fixtures) {
            await db.learningArtifact.deleteMany({ where: { id: fixture.artifactId } });
            await db.source.deleteMany({ where: { id: fixture.sourceId } });
            await db.workspace.deleteMany({ where: { id: fixture.workspaceId } });
            await db.user.deleteMany({ where: { id: fixture.userId } });
        }
        await db.$disconnect();
        await pool.end();
    });

    it("drains 1, 50, 51, 100 and 250-job backlogs with bounded attempts and no loss", async () => {
        const outbox = await import("../lib/outbox.js");
        for (const size of [1, 50, 51, 100, 250]) {
            const keys = await insertJobs(size);
            let processed = 0;
            // A simulated worker drains at most 50 due jobs per pass.
            for (let pass = 0; pass < Math.ceil(size / 50) + 2; pass += 1) {
                const due = await db.durableJob.findMany({
                    where: { key: { in: keys }, status: "PENDING" },
                    take: 50,
                    select: { key: true },
                });
                if (!due.length) break;
                for (const job of due) {
                    assert.equal(await outbox.claimDurableJob(job.key), true);
                    await outbox.markDurableJobDelivered(job.key);
                    processed += 1;
                }
            }

            assert.equal(processed, size, `no job lost in ${size}-job backlog`);
            const rows = await db.durableJob.findMany({
                where: { key: { in: keys } },
                select: { status: true, attempts: true, maxAttempts: true, deliveredAt: true },
            });
            assert.equal(rows.length, size);
            assert.ok(rows.every((row) => row.status === "DELIVERED"));
            // Successful claims do not consume an attempt; every row must still
            // stay within its bounded retry allowance.
            assert.ok(rows.every((row) => row.attempts <= row.maxAttempts));
            assert.ok(rows.every((row) => row.deliveredAt instanceof Date));
        }
    });

    it("bounded periodic sweep drains a 250-job backlog over repeated ticks", async () => {
        const { createDurableJobSweeper } = await import("../lib/job-sweeper.js");
        const keys = await insertJobs(250);
        const sweeper = createDurableJobSweeper(60_000);
        const counts: number[] = [];
        let touched = 0;
        for (let tick = 0; tick < 7 && touched < 250; tick += 1) {
            counts.push(await sweeper.tick());
            touched = await db.durableJob.count({
                where: { key: { in: keys }, attempts: { gt: 0 } },
            });
            // A failed local worker still releases with backoff, so the
            // dispatch return value can be 0 while the job was handled.
            assert.equal(touched, Math.min(50 * (tick + 1), 250));
        }
        sweeper.stop();

        assert.ok(counts.every((count) => count <= 50), `tick counts: ${counts}`);
        assert.equal(touched, 250);
        const rows = await db.durableJob.findMany({
            where: { key: { in: keys } },
            select: { status: true, attempts: true, lastError: true },
        });
        assert.equal(rows.length, 250);
        assert.ok(rows.every((row) => row.attempts === 1));
        assert.ok(rows.every((row) => row.status === "PENDING"));
        assert.ok(rows.every((row) => Boolean(row.lastError)));
        // Failed local workers must never report DELIVERED for unfinished work.
        assert.ok(rows.every((row) => row.status !== "DELIVERED"));
    });

    it("recovers a stale PROCESSING job after a simulated restart without double completion", async () => {
        const outbox = await import("../lib/outbox.js");
        const { recoverAbandonedDurableJobs } = outbox;
        const fixture = await createFixture();
        const key = `jr-restart-${randomUUID()}`;
        keysToClean.add(key);
        await db.durableJob.create({
            data: {
                key,
                type: "artifact.generate",
                payload: { artifactId: fixture.artifactId },
                status: "PROCESSING",
                attempts: 0,
                maxAttempts: 5,
            },
        });
        await ageProcessingJob(key, 20);

        // Simulates the startup recovery / periodic sweeper in a fresh process.
        await recoverAbandonedDurableJobs(50);
        let job = await db.durableJob.findUniqueOrThrow({ where: { key } });
        assert.equal(job.status, "PENDING");
        assert.equal(job.attempts, 1);
        assert.match(String(job.lastError), /Recovered abandoned processing job/);

        assert.equal(await outbox.claimDurableJob(key), true);
        await outbox.markDurableJobDelivered(key);
        await outbox.markDurableJobDelivered(key); // duplicate delivery
        job = await db.durableJob.findUniqueOrThrow({ where: { key } });
        assert.equal(job.status, "DELIVERED");
        assert.ok(job.deliveredAt instanceof Date);
        assert.equal(
            await db.creditTransaction.count({
                where: { idempotencyKey: `artifact-refund:${fixture.artifactId}` },
            }),
            0,
        );
    });

    it("does not fail or refund a READY artifact when a late job reaches DEAD", async () => {
        const outbox = await import("../lib/outbox.js");
        const fixture = await createFixture();
        const key = `jr-late-${randomUUID()}`;
        keysToClean.add(key);
        await db.learningArtifact.update({
            where: { id: fixture.artifactId },
            data: { status: "READY" },
        });
        await db.creditTransaction.create({
            data: {
                userId: fixture.userId,
                amount: -10,
                balanceAfter: 90,
                type: "ARTIFACT_GENERATE",
                description: "job recovery test charge",
                idempotencyKey: key,
            },
        });
        await db.durableJob.create({
            data: {
                key,
                type: "artifact.generate",
                payload: { artifactId: fixture.artifactId, chargeIdempotencyKey: key },
                status: "PROCESSING",
                attempts: 1,
                maxAttempts: 3,
            },
        });
        await ageProcessingJob(key, 20);

        await outbox.recoverAbandonedDurableJobs(50);
        let job = await db.durableJob.findUniqueOrThrow({ where: { key } });
        assert.notEqual(job.status, "DEAD");

        // Force the terminal transition to exercise the compensation guard.
        await db.durableJob.updateMany({
            where: { key },
            data: { status: "PROCESSING", attempts: 2 },
        });
        assert.equal(await outbox.releaseDurableJob(key, new Error("late failure")), "DEAD");
        job = await db.durableJob.findUniqueOrThrow({ where: { key } });
        assert.equal(job.status, "DEAD");
        assert.equal(job.attempts, 3);

        const artifact = await db.learningArtifact.findUniqueOrThrow({
            where: { id: fixture.artifactId },
        });
        assert.equal(artifact.status, "READY");
        assert.equal(artifact.refundedAt, null);
        assert.equal(
            await db.creditTransaction.count({
                where: { idempotencyKey: `artifact-refund:${fixture.artifactId}` },
            }),
            0,
        );
    });

    it("poison jobs reach DEAD at maxAttempts and compensate exactly once", async () => {
        const outbox = await import("../lib/outbox.js");
        const fixture = await createFixture();
        const key = `jr-poison-${randomUUID()}`;
        keysToClean.add(key);
        await db.creditTransaction.create({
            data: {
                userId: fixture.userId,
                amount: -10,
                balanceAfter: 90,
                type: "ARTIFACT_GENERATE",
                description: "poison job charge",
                idempotencyKey: key,
            },
        });
        await db.durableJob.create({
            data: {
                key,
                type: "artifact.generate",
                payload: { artifactId: fixture.artifactId, chargeIdempotencyKey: key },
                status: "PROCESSING",
                attempts: 0,
                maxAttempts: 3,
            },
        });

        const outcomes: string[] = [];
        for (let attempt = 0; attempt < 3; attempt += 1) {
            if (attempt > 0) {
                await db.durableJob.updateMany({
                    where: { key },
                    data: { status: "PROCESSING" },
                });
            }
            outcomes.push(String(await outbox.releaseDurableJob(key, new Error("poison"))));
        }
        assert.deepEqual(outcomes, ["RETRY", "RETRY", "DEAD"]);
        // A repeated release cannot compensate twice.
        assert.equal(await outbox.releaseDurableJob(key, new Error("again")), null);

        const job = await db.durableJob.findUniqueOrThrow({ where: { key } });
        assert.equal(job.status, "DEAD");
        assert.equal(job.attempts, 3);
        const artifact = await db.learningArtifact.findUniqueOrThrow({
            where: { id: fixture.artifactId },
        });
        assert.equal(artifact.status, "FAILED");
        assert.ok(artifact.refundedAt instanceof Date);
        assert.equal(
            await db.creditTransaction.count({
                where: { idempotencyKey: `artifact-refund:${fixture.artifactId}` },
            }),
            1,
        );
    });

    it("lets only one of two concurrent workers claim a job and never rewinds DELIVERED", async () => {
        const outbox = await import("../lib/outbox.js");
        const keys = await insertJobs(1);
        const key = keys[0];
        const claims = await Promise.all([
            outbox.claimDurableJob(key),
            outbox.claimDurableJob(key),
            outbox.claimDurableJob(key),
        ]);
        assert.equal(claims.filter(Boolean).length, 1);
        await outbox.markDurableJobDelivered(key);

        // Concurrent recovery workers must not rewind finished work.
        await outbox.requeueDurableJob(key);
        const row = await db.durableJob.findUniqueOrThrow({ where: { key } });
        assert.equal(row.status, "DELIVERED");

        // A job that is not yet due is never claimed early.
        const futureKey = (
            await insertJobs(1, { availableAt: new Date(Date.now() + 3_600_000) })
        )[0];
        assert.equal(await outbox.claimDurableJob(futureKey), false);
        assert.equal(
            (await db.durableJob.findUniqueOrThrow({ where: { key: futureKey } })).status,
            "PENDING",
        );
    });
});
