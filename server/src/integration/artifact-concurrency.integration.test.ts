import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Real-database checks for the artifact lease state machine. These tests only
 * run when TEST_DATABASE_URL points at a disposable database; production data
 * and DATABASE_URL are never used.
 */
describe("artifact concurrency (integration)", () => {
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

    type Fixture = { userId: string; workspaceId: string; artifactId: string };

    async function createFixture(
        status: "PENDING" | "PROCESSING" | "READY" = "PENDING",
        extra: Record<string, unknown> = {},
    ): Promise<Fixture> {
        const fixture: Fixture = {
            userId: `reliability-${randomUUID()}`,
            workspaceId: `ws-${randomUUID()}`,
            artifactId: `art-${randomUUID()}`,
        };
        await db.user.create({
            data: {
                id: fixture.userId,
                name: "Reliability test user",
                email: `${fixture.userId}@example.test`,
            },
        });
        await db.workspace.create({
            data: {
                id: fixture.workspaceId,
                userId: fixture.userId,
                title: "Reliability test workspace",
            },
        });
        await db.learningArtifact.create({
            data: {
                id: fixture.artifactId,
                workspaceId: fixture.workspaceId,
                type: "SUMMARY",
                title: "Reliability test artifact",
                status,
                ...extra,
            } as never,
        });
        return fixture;
    }

    async function removeFixture(fixture: Fixture): Promise<void> {
        await db.learningArtifact.deleteMany({ where: { id: fixture.artifactId } });
        await db.workspace.deleteMany({ where: { id: fixture.workspaceId } });
        await db.user.deleteMany({ where: { id: fixture.userId } });
    }

    it("allows exactly one of two concurrent claims", async () => {
        const repo = await import("../repository/artifact.repository.js");
        const fixture = await createFixture("PENDING");
        try {
            const results = await Promise.all([
                repo.claimArtifactForProcessing(fixture.artifactId, "token-a", 600_000),
                repo.claimArtifactForProcessing(fixture.artifactId, "token-b", 600_000),
            ]);

            assert.equal(results.filter(Boolean).length, 1);
            const artifact = await db.learningArtifact.findUniqueOrThrow({
                where: { id: fixture.artifactId },
            });
            assert.equal(artifact.status, "PROCESSING");
            assert.ok(artifact.leaseToken === "token-a" || artifact.leaseToken === "token-b");
        } finally {
            await removeFixture(fixture);
        }
    });

    it("keeps a live lease out of the stale sweep", async () => {
        const repo = await import("../repository/artifact.repository.js");
        const fixture = await createFixture("PROCESSING", {
            leaseToken: "live-lease",
            leaseExpiresAt: new Date(Date.now() + 600_000),
        });
        try {
            // Force updatedAt to look old while the lease is still valid.
            await db.$executeRaw`UPDATE "learning_artifact" SET "updatedAt" = ${new Date(Date.now() - 3_600_000)} WHERE "id" = ${fixture.artifactId}`;

            const stale = await repo.findStaleArtifactIdsForWorkspace(fixture.workspaceId);
            assert.equal(stale.includes(fixture.artifactId), false);

            const failed = await repo.markArtifactFailedIfEligible(
                fixture.artifactId,
                null,
                "stale sweep",
            );
            assert.equal(failed, false);

            const artifact = await db.learningArtifact.findUniqueOrThrow({
                where: { id: fixture.artifactId },
            });
            assert.equal(artifact.status, "PROCESSING");
        } finally {
            await removeFixture(fixture);
        }
    });

    it("does not let a stale lease completion overwrite READY", async () => {
        const repo = await import("../repository/artifact.repository.js");
        const fixture = await createFixture("PENDING");
        try {
            const claimed = await repo.claimArtifactForProcessing(
                fixture.artifactId,
                "original-lease",
                600_000,
            );
            assert.equal(claimed, true);

            await db.learningArtifact.updateMany({
                where: { id: fixture.artifactId },
                data: { status: "READY" },
            });

            const completed = await repo.completeArtifactProcessing(
                fixture.artifactId,
                "original-lease",
                { content: { stale: true } },
            );
            assert.equal(completed, false);

            const artifact = await db.learningArtifact.findUniqueOrThrow({
                where: { id: fixture.artifactId },
            });
            assert.equal(artifact.status, "READY");
            assert.equal((artifact.content as { stale?: boolean } | null)?.stale, undefined);
        } finally {
            await removeFixture(fixture);
        }
    });

    it("never refunds a READY artifact", async () => {
        const { markArtifactFailed } = await import("../services/artifact.services.js");
        const fixture = await createFixture("READY");
        try {
            await db.creditTransaction.create({
                data: {
                    userId: fixture.userId,
                    amount: -10,
                    balanceAfter: 40,
                    type: "ARTIFACT_GENERATE",
                    description: "integration charge",
                    idempotencyKey: `artifact-charge:${fixture.artifactId}`,
                },
            });

            await markArtifactFailed(fixture.artifactId, "late failure");

            const artifact = await db.learningArtifact.findUniqueOrThrow({
                where: { id: fixture.artifactId },
            });
            assert.equal(artifact.status, "READY");

            const refunds = await db.creditTransaction.count({
                where: {
                    idempotencyKey: `artifact-refund:${fixture.artifactId}`,
                },
            });
            assert.equal(refunds, 0);
        } finally {
            await removeFixture(fixture);
        }
    });
});
