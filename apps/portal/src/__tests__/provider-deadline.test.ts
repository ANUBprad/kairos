import { it, mock } from "node:test";
import assert from "node:assert/strict";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { ElevenLabsTTSProvider } from "@/lib/audio/providers/elevenlabs";

for (const operation of ["chat", "stream", "embedding", "tts"] as const) {
  it(`${operation} attaches a finite deadline even without caller cancellation`, async () => {
    const deadline = new AbortController();
    const timeout = mock.method(AbortSignal, "timeout", (ms: number) => {
      assert.ok(ms > 0 && ms <= 120_000);
      return deadline.signal;
    });
    let captured: AbortSignal | null | undefined;
    const fetch = mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
      captured = init?.signal;
      return new Response(operation === "stream" ? 'data: {"candidates":[]}\n\n'
        : JSON.stringify({ candidates: [], embedding: { values: [1, 0, 0] } }));
    });
    try {
      const provider = new GeminiProvider({ apiKey: "test-key" });
      const request = { model: "gemini-2.0-flash", messages: [{ role: "user" as const, content: "hi" }] };
      if (operation === "chat") await provider.generateChat(request);
      if (operation === "embedding") await provider.generateEmbedding({ input: "hi", model: "text-embedding-004" });
      if (operation === "stream") for await (const _chunk of provider.streamChat(request)) { /* consume */ }
      if (operation === "tts") await new ElevenLabsTTSProvider({ apiKey: "test-key" }).synthesize({ text: "hi", voiceId: "voice" });
      assert.ok(captured instanceof AbortSignal);
      assert.equal(timeout.mock.callCount(), 1);
      deadline.abort();
      assert.equal(captured.aborted, true);
    } finally {
      fetch.mock.restore();
      timeout.mock.restore();
    }
  });
}
