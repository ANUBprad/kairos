import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser } from "@/lib/server/demo-user";
import { listDocuments, renameDocument, deleteDocument, updateDocumentMetadata } from "@/lib/actions/document";

it("viewers can read documents but cannot rename, delete, or modify metadata", async (t) => {
  const url = process.env.KAIROS_TEST_DATABASE_URL;
  if (!url) { t.skip("requires test Postgres"); return; }
  const client = new PrismaClient({ datasources: { db: { url } } });
  const orgId = randomUUID();
  try {
    const userId = await ensureDemoUser();
    await client.organization.create({ data: {
      id: orgId, name: "Role test", slug: `role-${orgId}`, ownerId: userId,
      members: { create: { userId, role: "VIEWER" } },
    } });
    const project = await client.project.create({ data: { name: "Role test", slug: `role-${orgId}`, organizationId: orgId } });
    const kb = await client.knowledgeBase.create({ data: { name: "Role test", projectId: project.id } });
    const doc = await client.document.create({ data: { name: "original.txt", fileType: "txt", knowledgeBaseId: kb.id, metadata: {} } });
    assert.equal((await listDocuments(kb.id)).length, 1);
    const form = new FormData();
    form.set("id", doc.id);
    form.set("name", "changed.txt");
    for (const action of [
      () => renameDocument(form),
      () => updateDocumentMetadata(doc.id, { injected: true }),
      () => deleteDocument(form),
    ]) {
      await assert.rejects(action, /Access denied/);
    }
    const persisted = await client.document.findUniqueOrThrow({ where: { id: doc.id } });
    assert.equal(persisted.name, "original.txt");
    assert.deepEqual(persisted.metadata, {});
  } finally {
    await client.organization.deleteMany({ where: { id: orgId } });
    await client.$disconnect();
  }
});
