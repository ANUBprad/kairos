import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { detectQualityDrift } from "@/lib/observability/drift-detection";
import { createIncident, assignIncident } from "@/lib/observability/incidents";

it("scopes observability metrics and incident owners to the caller's organization", async (t) => {
  const url = process.env.KAIROS_TEST_DATABASE_URL;
  if (!url) { t.skip("requires test Postgres"); return; }
  const client = new PrismaClient({ datasources: { db: { url } } });
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  let kbA = "";
  let kbB = "";
  try {
    await client.$connect();
    await client.user.createMany({
      data: [
        { id: userA, email: `obs-a-${orgA}@test.local`, name: "A" },
        { id: userB, email: `obs-b-${orgB}@test.local`, name: "B" },
      ],
    });
    for (const [orgId, userId] of [[orgA, userA], [orgB, userB]] as const) {
      await client.organization.create({
        data: {
          id: orgId, name: `Obs ${orgId}`, slug: `obs-${orgId}`, ownerId: userId,
          members: { create: [{ userId, role: "OWNER" }] },
        },
      });
      const project = await client.project.create({ data: { name: "Obs", slug: `obs-${orgId}`, organizationId: orgId } });
      const kb = await client.knowledgeBase.create({ data: { name: "Obs", projectId: project.id } });
      if (orgId === orgA) kbA = kb.id; else kbB = kb.id;
    }

    // Quality drift aggregate must only see the caller's own runs.
    await client.experimentRun.createMany({
      data: [
        { configSnapshot: {}, retrievedChunks: [], query: "q", knowledgeBaseId: kbA, tokensUsed: 100 },
        { configSnapshot: {}, retrievedChunks: [], query: "q", knowledgeBaseId: kbA, tokensUsed: 200 },
        { configSnapshot: {}, retrievedChunks: [], query: "q", knowledgeBaseId: kbB, tokensUsed: 1000 },
      ],
    });
    const stats = await detectQualityDrift(orgA);
    assert.equal(stats.currentAvg, 150, "org B runs must not leak into org A's drift aggregate");

    // Incident owners must belong to the incident's organization, so a foreign
    // user's PII (joined into incident responses) cannot be attached and read.
    const incident = await client.incident.create({
      data: { title: "Owned", organizationId: orgA, ownerId: userA },
    });
    await assert.rejects(createIncident(orgA, { title: "Hijack", ownerId: userB }), /Owner not found/);
    await assert.rejects(assignIncident(incident.id, userB, orgA), /Owner not found/);
    await assignIncident(incident.id, userA, orgA);
    assert.equal((await client.incident.findUniqueOrThrow({ where: { id: incident.id } })).ownerId, userA);
  } finally {
    await client.incident.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await client.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await client.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await client.$disconnect();
  }
});