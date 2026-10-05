import { it, mock } from "node:test";
import assert from "node:assert/strict";
import { GeminiProvider } from "@/lib/ai/providers/gemini";

it("requests the SSE representation consumed by the Gemini stream parser", async () => {
  const payload = { candidates: [{ content: { parts: [{ text: "Hello" }] } }] };
  const fetch = mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const sse = new URL(String(url)).searchParams.get("alt") === "sse";
    return new Response(sse ? `data: ${JSON.stringify(payload)}\n\n` : JSON.stringify([payload]), {
      headers: { "content-type": sse ? "text/event-stream" : "application/json" },
    });
  });
  try {
    const provider = new GeminiProvider({ apiKey: "test-key" });
    const chunks: string[] = [];
    for await (const chunk of provider.streamChat({ model: "gemini-2.0-flash", messages: [{ role: "user", content: "hi" }] })) {
      if (!chunk.done) chunks.push(chunk.content);
    }
    assert.deepEqual(chunks, ["Hello"]);
  } finally {
    fetch.mock.restore();
  }
});
