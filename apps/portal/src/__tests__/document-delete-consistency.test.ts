import { it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

const doc = { id: "doc", name: "file.txt", knowledgeBaseId: "kb", storageKey: "file" };
const client = {
  user: { findUnique: async () => ({ id: "user" }) },
  knowledgeBase: { findUnique: async () => ({ project: { organization: { members: [{ id: "member", role: "OWNER" }] } } }) },
  document: {
    findUnique: async () => doc,
    findMany: async () => [doc],
    delete: async () => { throw new Error("Database unavailable"); },
    deleteMany: () => ({}),
  },
  documentActivity: { create: async () => ({}), createMany: () => ({}) },
  $transaction: async () => { throw new Error("Database unavailable"); },
};
(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient;

it("keeps stored files when single or bulk database deletion fails", async (t) => {
  process.env.KAIROS_DEMO_MODE = "true";
  process.env.CLOUDINARY_CLOUD_NAME = "test";
  process.env.CLOUDINARY_API_KEY = "test";
  process.env.CLOUDINARY_API_SECRET = "test";
  const destroy = t.mock.method(cloudinary.uploader, "destroy", async () => ({}));
  const { deleteDocument, bulkDeleteDocuments } = await import("@/lib/actions/document");
  const form = new FormData();
  form.set("id", doc.id);
  form.set("ids", doc.id);
  for (const action of [deleteDocument, bulkDeleteDocuments]) {
    await assert.rejects(() => action(form), /Database unavailable/);
    assert.equal(destroy.mock.callCount(), 0, "storage must survive a failed database deletion");
  }
});
