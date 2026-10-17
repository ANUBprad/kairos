// Retrieval strategy allowlist: a strategy identifier is config/DB supplied and
// is not proof that the strategy exists. Only names the registry can actually
// run are accepted; unknown or dormant names are refused rather than silently
// masquerading as vector search, and the offer list never advertises a strategy
// the engine cannot execute.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SUPPORTED_STRATEGIES,
  isSupportedStrategy,
  resolveSupportedStrategy,
  strategyRegistry,
} from "@/lib/retrieval/strategies";
import { saveRetrievalConfig } from "@/lib/retrieval/service";

const SRC = join(import.meta.dirname, "..");
const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

describe("retrieval strategy allowlist", () => {
  it("accepts every registered strategy unchanged", () => {
    for (const name of SUPPORTED_STRATEGIES) {
      assert.equal(resolveSupportedStrategy(name), name);
      assert.ok(isSupportedStrategy(name));
    }
  });

  it("refuses unknown and dormant strategy names without throwing", () => {
    for (const name of ["multi-query", "reranking", "query-expansion", "nonsense", "", null, undefined, 42]) {
      assert.equal(resolveSupportedStrategy(name), "vector");
      assert.ok(!isSupportedStrategy(name));
    }
  });

  it("cannot drift from the strategies the registry actually holds", () => {
    const registered = strategyRegistry
      .getAll()
      .map((s) => s.name)
      .sort();
    assert.deepEqual([...SUPPORTED_STRATEGIES].sort(), registered);
  });

  it("does not advertise dormant strategies in the UI offer list", () => {
    const source = readFileSync(join(SRC, "lib/retrieval/types.ts"), "utf8");
    for (const dormant of ["multi-query", "reranking", "query-expansion"]) {
      assert.ok(
        !source.includes(`value: "${dormant}"`),
        `${dormant} must not be offered as a selectable strategy`,
      );
    }
  });

  it("rejects an unsupported strategy at the config write boundary", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    // The guard runs before the row is written, so a non-existent kbId is safe
    // and leaves the database untouched.
    await assert.rejects(
      () => saveRetrievalConfig("no-such-kb-for-strategy-guard", { retrievalStrategy: "multi-query" }),
      /Unsupported retrieval strategy/,
    );
    await assert.rejects(
      () => saveRetrievalConfig("no-such-kb-for-strategy-guard", { retrievalMode: "nonsense" as never }),
      /Unsupported retrieval mode/,
    );
  });
});
