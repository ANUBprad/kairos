import { it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_RETRIEVAL_CONFIG } from "@/lib/retrieval/types";

const client = {
  user: { findUnique: async () => ({ id: "user" }) },
  knowledgeBase: {
    findUnique: async () => ({ retrievalConfig: {}, project: { organization: { members: [{ id: "member", role: "VIEWER" }] } } }),
    update: async () => { throw new Error("Configuration write reached"); },
  },
};
(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient;

it("viewers can read retrieval settings but cannot change or execute experiments", async () => {
  process.env.KAIROS_DEMO_MODE = "true";
  const { getKbRetrievalConfig, updateKbRetrievalConfig, executeRetrieval, executeComparison, persistRun } = await import("@/lib/actions/retrieval-lab");
  assert.equal((await getKbRetrievalConfig("kb")).topK, DEFAULT_RETRIEVAL_CONFIG.topK);
  const result = { chunks: [], query: "query", totalChunks: 0, latencyMs: 0, metrics: { totalMs: 0, embeddingMs: 0, vectorSearchMs: 0 } };
  for (const action of [
    () => updateKbRetrievalConfig("kb", { topK: 20 }),
    () => executeRetrieval("kb", "query", DEFAULT_RETRIEVAL_CONFIG),
    () => executeComparison("kb", "query", DEFAULT_RETRIEVAL_CONFIG, DEFAULT_RETRIEVAL_CONFIG),
    () => persistRun("kb", "query", DEFAULT_RETRIEVAL_CONFIG, result),
  ]) await assert.rejects(action, /Knowledge base not found/);
});
