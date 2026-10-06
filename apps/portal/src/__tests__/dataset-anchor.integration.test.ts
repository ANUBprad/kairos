import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertDatasetAccess } from "@/lib/evaluation/access";

it("does not turn a tenant dataset global when its KB, project, or organization is deleted", async (t) => {
  const url = process.env.KAIROS_TEST_DATABASE_URL;
  if (!url) { t.skip("requires test Postgres"); return; }
  const client = new PrismaClient({ datasources: { db: { url } } });
  const userId = randomUUID();
  const orgId = randomUUID();
  const datasetId = randomUUID();
  try {
    await client.user.create({ data: { id: userId, email: `anchor-${userId}@test.local`, name: "Owner" } });
    await client.organization.create({ data: {
      id: orgId, name: "Dataset anchor", slug: `anchor-${orgId}`, ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
    } });
    const project = await client.project.create({ data: { name: "Anchor", slug: `anchor-${orgId}`, organizationId: orgId } });
    const kb = await client.knowledgeBase.create({ data: { name: "Anchor", projectId: project.id } });
    await client.benchmarkDataset.create({ data: { id: datasetId, name: "Private dataset", knowledgeBaseId: kb.id } });
    for (const remove of [
      () => client.knowledgeBase.delete({ where: { id: kb.id } }),
      () => client.project.delete({ where: { id: project.id } }),
      () => client.organization.delete({ where: { id: orgId } }),
    ]) {
      await assert.rejects(remove, { code: "P2003" });
      assert.equal((await client.benchmarkDataset.findUniqueOrThrow({ where: { id: datasetId } })).knowledgeBaseId, kb.id);
      await assert.rejects(() => assertDatasetAccess(datasetId, "foreign-user"), /Dataset not found/);
    }
  } finally {
    await client.benchmarkDataset.deleteMany({ where: { id: datasetId } });
    await client.organization.deleteMany({ where: { id: orgId } });
    await client.user.deleteMany({ where: { id: userId } });
    await client.$disconnect();
  }
});
