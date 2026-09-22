import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveStreamGate } from "@/lib/ai/chat/stream-gate";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveStreamGate", () => {
  it("accepts a 200 text/event-stream response", async () => {
    const res = new Response("data: {}\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
    assert.deepEqual(await resolveStreamGate(res), { streaming: true, error: null });
  });

  it("rejects a 200 with a non-SSE content type", async () => {
    const res = new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    const result = await resolveStreamGate(res);
    assert.equal(result.streaming, false);
    assert.equal(result.error, "Unexpected server response");
  });

  it("surfaces the server-controlled error message on a JSON 4xx", async () => {
    for (const [status, error] of [
      [401, "Not authenticated"],
      [429, "Rate limit exceeded"],
      [404, "Conversation not found"],
    ] as const) {
      const result = await resolveStreamGate(jsonResponse({ error }, status));
      assert.equal(result.streaming, false);
      assert.equal(result.error, error);
    }
  });

  it("falls back to the generic message for a non-JSON error body", async () => {
    const res = new Response("Internal Server Error", { status: 500 });
    const result = await resolveStreamGate(res);
    assert.equal(result.streaming, false);
    assert.equal(result.error, "Request failed");
  });

  it("falls back to the generic message for a JSON error body without an error string", async () => {
    const result = await resolveStreamGate(jsonResponse({ detail: "boom" }, 500));
    assert.equal(result.streaming, false);
    assert.equal(result.error, "Request failed");
  });

  it("never forwards internal detail fields", async () => {
    const result = await resolveStreamGate(jsonResponse({ error: "Internal server error", errorId: "abc" }, 500));
    assert.equal(result.streaming, false);
    assert.equal(result.error, "Internal server error");
  });
});