import { it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const write = async () => { throw new Error("Unscoped write reached"); };
const client = {
  promptFolder: { findFirst: async () => null, create: write },
  prompt: {
    findFirst: async () => ({ id: "prompt" }),
    findUnique: async () => ({ id: "prompt", organizationId: "own-org" }),
    create: write, update: write,
  },
};
(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient;

it("rejects foreign folders before creating or moving prompt resources", async () => {
  const { createFolder, createPrompt, updatePrompt } = await import("@/lib/prompts");
  await assert.rejects(() => createFolder("own-org", { name: "nested", parentId: "foreign" }), /Folder not found/);
  await assert.rejects(() => createPrompt("own-org", "user", {
    title: "prompt", folderId: "foreign", systemPrompt: "system", userPrompt: "user",
  }), /Folder not found/);
  await assert.rejects(() => updatePrompt("prompt", { folderId: "foreign" }, "own-org"), /Folder not found/);
});
