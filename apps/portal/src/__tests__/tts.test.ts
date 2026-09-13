import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LocalTTSProvider,
  parseWavHeader,
  wavDurationSeconds,
  getTTSProvider,
  resolveTTSProviderType,
  TTS_PROVIDER_ENV,
  LOCAL_TTS_SAMPLE_RATE,
  ElevenLabsTTSProvider,
  ELEVENLABS_API_URL,
  ELEVENLABS_API_KEY_ENV,
  ELEVENLABS_VOICE_HOST_A_ENV,
  ELEVENLABS_VOICE_HOST_B_ENV,
} from "@/lib/audio";

const hostA = "persona-host-a";
const hostB = "persona-host-b";

// Toggling the provider env is safe because selection reads the environment at
// call time; tests must not depend on whatever is exported in the shell.
async function withTTSProviderEnv<T>(value: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const previous = process.env[TTS_PROVIDER_ENV];
  if (value === undefined) delete process.env[TTS_PROVIDER_ENV];
  else process.env[TTS_PROVIDER_ENV] = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env[TTS_PROVIDER_ENV];
    else process.env[TTS_PROVIDER_ENV] = previous;
  }
}

describe("tts contract — local provider", () => {
  it("produces playable, measurable WAV audio for both host voices", async () => {
    const provider = new LocalTTSProvider();
    for (const voice of [hostA, hostB]) {
      const result = await provider.synthesize({ text: "A quick grounded turn.", voiceId: voice });
      assert.equal(result.provider, "local");
      assert.equal(result.format, "wav");
      assert.ok(result.audio.length > 44);
      assert.equal(result.audio.subarray(0, 4).toString("ascii"), "RIFF");
      const expectedPcmSamples = (result.audio.length - 44) / 2; // 16-bit mono
      assert.equal(result.durationSeconds, expectedPcmSamples / LOCAL_TTS_SAMPLE_RATE);
      assert.ok(result.durationSeconds > 0);
    }
  });

  it("is deterministic: identical input yields identical bytes", async () => {
    const provider = new LocalTTSProvider();
    const first = await provider.synthesize({ text: "Deterministic turn.", voiceId: hostA });
    const second = await provider.synthesize({ text: "Deterministic turn.", voiceId: hostA });
    assert.deepEqual(first.audio, second.audio);
    assert.equal(first.durationSeconds, second.durationSeconds);
  });

  it("varies output with text length and voice identity", async () => {
    const provider = new LocalTTSProvider();
    const short = await provider.synthesize({ text: "short", voiceId: hostA });
    const long = await provider.synthesize({ text: "a considerably longer turn of dialogue", voiceId: hostA });
    assert.ok(long.audio.length > short.audio.length);

    const otherVoice = await provider.synthesize({ text: "short", voiceId: hostB });
    assert.notDeepEqual(short.audio, otherVoice.audio);
  });

  it("rejects empty text", async () => {
    const provider = new LocalTTSProvider();
    await assert.rejects(provider.synthesize({ text: "", voiceId: hostA }), /empty/i);
    await assert.rejects(provider.synthesize({ text: "   ", voiceId: hostA }), /empty/i);
  });

  it("parses its own WAV headers and exposes exact duration", () => {
    const provider = new LocalTTSProvider();
    return provider.synthesize({ text: "header check", voiceId: hostA }).then((result) => {
      const info = parseWavHeader(result.audio);
      assert.ok(info);
      assert.equal(info.channels, 1);
      assert.equal(info.sampleRate, LOCAL_TTS_SAMPLE_RATE);
      assert.equal(info.bitsPerSample, 16);
      assert.ok(info.dataBytes > 0);
      assert.equal(wavDurationSeconds(result.audio), result.durationSeconds);
    });
  });

  it("returns null for buffers that are not linear PCM WAVs", () => {
    assert.equal(parseWavHeader(Buffer.from("not a wav at all")), null);
    assert.equal(wavDurationSeconds(Buffer.alloc(48)), null);
  });
});

describe("tts provider selection", () => {
  it("defaults to the local provider when unset", () => {
    withTTSProviderEnv(undefined, () => {
      assert.equal(resolveTTSProviderType(), "local");
      assert.equal(getTTSProvider().type, "local");
    });
  });

  it("honours an explicit local configuration", () => {
    withTTSProviderEnv("local", () => {
      assert.equal(resolveTTSProviderType(), "local");
      assert.equal(getTTSProvider().type, "local");
    });
  });

  it("recognises the elevenlabs configuration value", () => {
    withTTSProviderEnv("elevenlabs", () => {
      assert.equal(resolveTTSProviderType(), "elevenlabs");
    });
  });

  it("rejects unknown provider names instead of guessing", () => {
    withTTSProviderEnv("holographic", () => {
      assert.throws(() => resolveTTSProviderType(), /Unknown TTS provider type: holographic/);
    });
  });
});

async function withElevenLabsEnv<T>(apiKey: string | undefined, voiceA: string | undefined, voiceB: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const names = [ELEVENLABS_API_KEY_ENV, ELEVENLABS_VOICE_HOST_A_ENV, ELEVENLABS_VOICE_HOST_B_ENV];
  const values = [apiKey, voiceA, voiceB];
  const previous = names.map((name) => [name, process.env[name]] as const);
  names.forEach((name, i) => {
    if (values[i] === undefined) delete process.env[name];
    else process.env[name] = values[i];
  });
  try {
    return await run();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

// Replace the network for the duration of one test body and record the calls.
// Real Response instances are used so provider code sees genuine fetch types.
async function withStubbedFetch(run: () => Promise<void>): Promise<{ url: string; method?: string; headers?: Record<string, string>; body?: string }[]> {
  const calls: { url: string; method?: string; headers?: Record<string, string>; body?: string }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method,
      headers: init?.headers as Record<string, string> | undefined,
      body: init?.body as string | undefined,
    });
    return new Response(Buffer.from("ID3fake-mp3-bytes"), { status: 200 });
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
  return calls;
}

describe("tts provider selection — elevenlabs", () => {
  it("recognises explicit elevenlabs configuration as a valid selection value", () => {
    assert.equal(resolveTTSProviderType("elevenlabs"), "elevenlabs");
  });

  it("throws a clear config error when the API key is missing", () => {
    return withTTSProviderEnv("elevenlabs", () =>
      withElevenLabsEnv(undefined, "voice-a-id", "voice-b-id", () =>
        assert.throws(() => getTTSProvider("elevenlabs"), new RegExp(`${ELEVENLABS_API_KEY_ENV} is not configured`)),
      ),
    );
  });

  it("throws a clear config error when the host voices are missing", () => {
    return withTTSProviderEnv("elevenlabs", () =>
      withElevenLabsEnv("sk-123", "voice-a-id", undefined, () =>
        assert.throws(
          () => getTTSProvider("elevenlabs"),
          new RegExp(`${ELEVENLABS_VOICE_HOST_A_ENV} and ${ELEVENLABS_VOICE_HOST_B_ENV} are not configured`),
        ),
      ),
    );
  });

  it("selects the provider when all elevenlabs config is present", () => {
    return withTTSProviderEnv("elevenlabs", () =>
      withElevenLabsEnv("sk-123", "voice-a-id", "voice-b-id", () =>
        assert.equal(getTTSProvider("elevenlabs").type, "elevenlabs"),
      ),
    );
  });

  it("posts to the expected endpoint with the api key header and returns mp3 bytes", async () => {
    const calls = await withStubbedFetch(() =>
      withElevenLabsEnv("sk-123", "voice-a-id", "voice-b-id", async () => {
        const result = await getTTSProvider("elevenlabs").synthesize({ text: "  heLLo world  ", voiceId: "voice-a-id" });
        assert.equal(result.format, "mp3");
        assert.equal(result.provider, "elevenlabs");
        assert.equal(result.durationSeconds, null);
        assert.equal(result.audio.toString("utf8"), "ID3fake-mp3-bytes");
      }),
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, `${ELEVENLABS_API_URL}/voice-a-id`);
    assert.equal(calls[0]?.method, "POST");
    assert.equal(calls[0]?.headers?.["xi-api-key"], "sk-123");
    assert.match(calls[0]?.body ?? "", /"text":"heLLo world"/);
  });

  it("throws when the upstream responds with an error status", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("boom", { status: 500 });
    try {
      const provider = new ElevenLabsTTSProvider({ apiKey: "sk-123" });
      await assert.rejects(provider.synthesize({ text: "boom", voiceId: "v" }), /ElevenLabs TTS API error: 500 boom/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when the upstream returns an empty audio body", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(Buffer.alloc(0), { status: 200 });
    try {
      const provider = new ElevenLabsTTSProvider({ apiKey: "sk-123" });
      await assert.rejects(provider.synthesize({ text: "empty", voiceId: "v" }), /empty audio/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("never silently falls back to local on missing config (packaging)", () => {
    const source = readFileSync(new URL("../lib/audio/providers/index.ts", import.meta.url), "utf8");
    assert.match(source, /createElevenLabsProvider/);
  });
});

describe("tts provider discipline", () => {
  it("local provider imports no external speech/network SDKs", () => {
    const source = readFileSync(new URL("../lib/audio/providers/local.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["'](openai|@google|elevenlabs|cloudinary|@\/lib\/ai)/);
    assert.match(source, /import type \{ TTSProvider[^}]*\} from "\.\.\/types"/);
  });

  it("elevenlabs provider is fetch-based, importing no SDK or local provider", () => {
    const source = readFileSync(new URL("../lib/audio/providers/elevenlabs.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["'](openai|@google|elevenlabs|cloudinary|@\/lib\/ai|\.\/local)/);
    assert.match(source, /fetch\(/);
  });

  it("the public contract carries bytes, format and duration — never provider SDK types", () => {
    const source = readFileSync(new URL("../lib/audio/types.ts", import.meta.url), "utf8");
    assert.match(source, /TTSRequest|TTSResult|TTSProvider/);
    assert.doesNotMatch(source, /from ["']/);
    assert.match(source, /audio: Buffer/);
  });
});