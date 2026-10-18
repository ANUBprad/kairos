import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// /api/metrics served `getMetrics()`, but nothing ever incremented the
// counters or observed the histograms, so the endpoint always reported an
// empty object. The chat turn is where there is something real to count.

const SRC = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

describe("chat metrics contract", () => {
  it("counts completed and failed chat turns", () => {
    const route = read("app/api/ai/chat/route.ts");
    assert.match(route, /incrementCounter\("ai_chat_requests_total"\)/);
    assert.match(route, /incrementCounter\("ai_chat_errors_total"\)/);
    assert.match(route, /observeHistogram\("ai_chat_generation_ms"/);
  });
});
