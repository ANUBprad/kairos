import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { MAX_OUTPUT_TOKENS, resolveMaxOutputTokens } from "@/lib/ai/providers/types";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { GeminiProvider } from "@/lib/ai/providers/gemini";

// The clamp is the only server-side bound on generated tokens for the chat,
// artifact, and evaluation call sites, all of which omit maxTokens. If it stops
// reaching the provider, every one of those requests silently becomes unbounded.
describe("generated-token ceiling", () => {
  const originalEnv = process.env.AI_MAX_OUTPUT_TOKENS;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AI_MAX_OUTPUT_TOKENS;
    else process.env.AI_MAX_OUTPUT_TOKENS = originalEnv;
    if (originalFetch) globalThis.fetch = originalFetch;
  });

  it("applies the default ceiling when a caller requests no limit", () => {
    assert.equal(resolveMaxOutputTokens(undefined), MAX_OUTPUT_TOKENS);
  });

  it("keeps a caller request that is already under the ceiling", () => {
    assert.equal(resolveMaxOutputTokens(256), 256);
  });

  it("clamps a caller request above the ceiling", () => {
    assert.equal(resolveMaxOutputTokens(10_000_000), MAX_OUTPUT_TOKENS);
  });

  it("honours a configured ceiling and ignores a nonsense one", () => {
    process.env.AI_MAX_OUTPUT_TOKENS = "512";
    assert.equal(resolveMaxOutputTokens(undefined), 512);
    assert.equal(resolveMaxOutputTokens(4096), 512);

    process.env.AI_MAX_OUTPUT_TOKENS = "not-a-number";
    assert.equal(resolveMaxOutputTokens(undefined), MAX_OUTPUT_TOKENS);
  });

  it("never returns a non-positive limit", () => {
    assert.equal(resolveMaxOutputTokens(0), 1);
    assert.equal(resolveMaxOutputTokens(-5), 1);
  });

  it("sends the clamped limit on an OpenAI generation that requested none", async () => {
    process.env.AI_MAX_OUTPUT_TOKENS = "777";
    let capturedBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "cmpl-1",
          object: "chat.completion",
          created: 0,
          model: "gpt-4o-mini",
          choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    const provider = new OpenAIProvider({ apiKey: "test-key" });
    const response = await provider.generateChat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
    });

    assert.equal(capturedBody?.max_tokens, 777);
    // Provider-reported usage still passes through untouched.
    assert.deepEqual(response.usage, { promptTokens: 12, completionTokens: 3, totalTokens: 15 });
  });

  it("sends the clamped limit on a Gemini generation and keeps a smaller request", async () => {
    process.env.AI_MAX_OUTPUT_TOKENS = "777";
    const captured: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      captured.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "ok" }] } }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    const provider = new GeminiProvider({ apiKey: "test-key" });
    await provider.generateChat({ model: "gemini-2.0-flash", messages: [{ role: "user", content: "hi" }] });
    await provider.generateChat({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 64,
    });

    const configOf = (i: number) => captured[i].generationConfig as Record<string, unknown>;
    assert.equal(configOf(0).maxOutputTokens, 777);
    assert.equal(configOf(1).maxOutputTokens, 64);
  });
});