import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { GeminiProvider } from "@/lib/ai/providers/gemini";

describe("OpenAI provider passes signal to fetch", () => {
  let originalFetch: typeof globalThis.fetch;

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch;
  });

  it("includes AbortSignal in the underlying fetch call", async () => {
    originalFetch = globalThis.fetch;
    let capturedInit: RequestInit | undefined;
    const encoder = new TextEncoder();

    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedInit = init;
      const body = [
        `data: {"id":"cmpl","object":"chat.completion.chunk","created":0,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n`,
        `data: {"id":"cmpl","object":"chat.completion.chunk","created":0,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
        `data: [DONE]\n\n`,
      ].join("");
      return new Response(new ReadableStream({ start(c) { c.enqueue(encoder.encode(body)); c.close(); } }), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }) as typeof globalThis.fetch;

    const provider = new OpenAIProvider({ apiKey: "test-key" });
    const controller = new AbortController();
    const chunks: string[] = [];

    for await (const chunk of provider.streamChat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    })) {
      if (!chunk.done && chunk.content) chunks.push(chunk.content);
    }

    assert.ok(capturedInit, "fetch must have been called");
    assert.ok(capturedInit.signal instanceof AbortSignal, "fetch must receive an AbortSignal");
    controller.abort();
    assert.equal(capturedInit.signal.aborted, true, "aborting the controller must abort the fetch signal");
    assert.deepEqual(chunks, ["Hi"]);
  });
});

describe("Gemini provider passes signal to fetch", () => {
  let originalFetch: typeof globalThis.fetch;

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch;
  });

  it("rejects immediately when signal is already aborted", async () => {
    const provider = new GeminiProvider({ apiKey: "test-key" });
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      () => provider.streamChat({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "hi" }],
        signal: controller.signal,
      }).next(),
      (err: unknown) => err instanceof Error && err.name === "AbortError",
    );
  });

  it("passes signal to fetch and streams normally when not aborted", async () => {
    originalFetch = globalThis.fetch;
    let capturedSignal: AbortSignal | undefined;
    const encoder = new TextEncoder();

    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      const body = `data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n`;
      return new Response(new ReadableStream({ start(c) { c.enqueue(encoder.encode(body)); c.close(); } }), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }) as typeof globalThis.fetch;

    const provider = new GeminiProvider({ apiKey: "test-key" });
    const controller = new AbortController();
    const chunks: string[] = [];

    for await (const chunk of provider.streamChat({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    })) {
      if (!chunk.done) chunks.push(chunk.content);
    }

    assert.ok(capturedSignal, "fetch must have been called");
    assert.equal(capturedSignal, controller.signal, "signal must be passed through to fetch");
    assert.deepEqual(chunks, ["Hello"]);
  });
});
