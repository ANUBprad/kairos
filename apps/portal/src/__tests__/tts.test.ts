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
} from "@/lib/audio";

const hostA = "persona-host-a";
const hostB = "persona-host-b";

// Toggling the provider env is safe because selection reads the environment at
// call time; tests must not depend on whatever is exported in the shell.
function withTTSProviderEnv(value: string | undefined, run: () => void) {
  const previous = process.env[TTS_PROVIDER_ENV];
  if (value === undefined) delete process.env[TTS_PROVIDER_ENV];
  else process.env[TTS_PROVIDER_ENV] = value;
  try {
    run();
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

  it("recognises the elevenlabs configuration value (provider routing lands with the provider)", () => {
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

describe("tts provider discipline", () => {
  it("local provider imports no external speech/network SDKs", () => {
    const source = readFileSync(new URL("../lib/audio/providers/local.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["'](openai|@google|elevenlabs|cloudinary|@\/lib\/ai)/);
    assert.match(source, /import type \{ TTSProvider[^}]*\} from "\.\.\/types"/);
  });

  it("the public contract carries bytes, format and duration — never provider SDK types", () => {
    const source = readFileSync(new URL("../lib/audio/types.ts", import.meta.url), "utf8");
    assert.match(source, /TTSRequest|TTSResult|TTSProvider/);
    assert.doesNotMatch(source, /from ["']/);
    assert.match(source, /audio: Buffer/);
  });
});