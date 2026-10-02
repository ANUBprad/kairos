import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregateTokensUsed } from "@/lib/experiment-engine";

// The experiment engine used to report tokens derived from the answer length
// and multiply them by a hardcoded price table. Both were persisted per run and
// streamed to the client as if the provider had reported them.
describe("experiment usage honesty", () => {
  it("totals reported usage when every question reported it", () => {
    assert.equal(aggregateTokensUsed([{ tokensUsed: 100 }, { tokensUsed: 250 }]), 350);
  });

  it("reports unknown instead of a partial sum when any question is unknown", () => {
    assert.equal(aggregateTokensUsed([{ tokensUsed: 100 }, { tokensUsed: null }]), null);
    assert.equal(aggregateTokensUsed([{ tokensUsed: null }, { tokensUsed: null }]), null);
  });

  it("reports unknown for a run with no reported usage", () => {
    assert.equal(aggregateTokensUsed([]), null);
  });
});

describe("experiment usage sources", () => {
  const source = readFileSync(
    new URL("../lib/experiment-engine.ts", import.meta.url),
    "utf8",
  );

  it("records only what the provider reported, never a derived figure", () => {
    assert.match(source, /tokensUsed = response\.usage\?\.totalTokens \?\? null;/);
    assert.doesNotMatch(source, /estimateTokens/);
  });

  it("no longer invents a dollar cost from a price table", () => {
    assert.doesNotMatch(source, /estimateCost/);
    assert.doesNotMatch(source, /costUsd/);
  });

  it("keeps the metric nullable so unknown survives to the record", () => {
    assert.match(source, /tokensUsed: number \| null;/);
  });
});