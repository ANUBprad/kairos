import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LocalTTSProvider,
  buildLocalWav,
  parseWavHeader,
  assemblePodcastSegments,
  PODCAST_TURN_PAUSE_SECONDS,
  generatePodcastAudio,
  resolveSpeakerVoiceId,
  PODCAST_VOICE_HOST_A,
  PODCAST_VOICE_HOST_B,
  LOCAL_TTS_SAMPLE_RATE,
  ELEVENLABS_VOICE_HOST_A_ENV,
  ELEVENLABS_VOICE_HOST_B_ENV,
} from "@/lib/audio";
import type { TTSProvider } from "@/lib/audio";

const hostA = "persona-host-a";
const hostB = "persona-host-b";

function wavAtRate(source: Buffer, sampleRate: number): Buffer {
  const copy = Buffer.from(source);
  copy.writeUInt32LE(sampleRate, 24);
  copy.writeUInt32LE(sampleRate * 2, 28); // mono 16-bit block rate
  return copy;
}

function expectedWavDuration(segments: Buffer[]): number {
  const dataBytes = segments.reduce((total, segment) => total + (parseWavHeader(segment)?.dataBytes ?? 0), 0);
  const pauses = (segments.length - 1) * Math.round(LOCAL_TTS_SAMPLE_RATE * PODCAST_TURN_PAUSE_SECONDS) * 2;
  return (dataBytes + pauses) / (LOCAL_TTS_SAMPLE_RATE * 2);
}

describe("podcast audio assembly", () => {
  it("joins wav segments into one playable episode with the exact summed duration", () => {
    const segments = [
      { audio: buildLocalWav(hostA, "First turn."), format: "wav" as const },
      { audio: buildLocalWav(hostB, "Second turn, a little longer."), format: "wav" as const },
      { audio: buildLocalWav(hostA, "Third."), format: "wav" as const },
    ];
    const assembled = assemblePodcastSegments(segments);

    assert.equal(assembled.format, "wav");
    const info = parseWavHeader(assembled.audio);
    assert.ok(info);
    assert.equal(info.sampleRate, LOCAL_TTS_SAMPLE_RATE);
    assert.equal(assembled.durationSeconds, expectedWavDuration(segments.map((s) => s.audio)));
    assert.equal(assembled.durationSeconds, info.dataBytes / (info.sampleRate * 2));
  });

  it("is deterministic for identical segments", () => {
    const segments = [
      { audio: buildLocalWav(hostA, "Same."), format: "wav" as const },
      { audio: buildLocalWav(hostB, "Same."), format: "wav" as const },
    ];
    const first = assemblePodcastSegments(segments);
    const second = assemblePodcastSegments(segments);
    assert.deepEqual(first, second);
  });

  it("concatenates mp3 segments and reports no fabricated duration", () => {
    const segments = [
      { audio: Buffer.from("Id3aaa"), format: "mp3" as const },
      { audio: Buffer.from("Id3bbb"), format: "mp3" as const },
    ];
    const assembled = assemblePodcastSegments(segments);
    assert.equal(assembled.format, "mp3");
    assert.equal(assembled.durationSeconds, null);
    assert.equal(assembled.audio.toString("utf8"), "Id3aaaId3bbb");
  });

  it("rejects empty segment lists and zero-length mp3 segments", () => {
    assert.throws(() => assemblePodcastSegments([]), /no spoken turns/);
    assert.throws(
      () => assemblePodcastSegments([{ audio: Buffer.alloc(0), format: "mp3" as const }]),
      /Empty audio segment/,
    );
  });

  it("rejects mixed wav/mp3 sources (single-provider episodes only)", () => {
    assert.throws(
      () =>
        assemblePodcastSegments([
          { audio: buildLocalWav(hostA, "wav"), format: "wav" as const },
          { audio: Buffer.from("Id3mp3"), format: "mp3" as const },
        ]),
      /mixed WAV and MP3/,
    );
  });

  it("rejects non-wav buffers in a wav-only episode", () => {
    assert.throws(
      () =>
        assemblePodcastSegments([
          { audio: Buffer.from("definitely not a wav, just long enough bytes"), format: "wav" as const },
        ]),
      /not a linear PCM WAV/,
    );
  });

  it("rejects wav segments with mismatched formats", () => {
    assert.throws(
      () =>
        assemblePodcastSegments([
          { audio: buildLocalWav(hostA, "ok"), format: "wav" as const },
          { audio: wavAtRate(buildLocalWav(hostB, "different rate"), 8000), format: "wav" as const },
        ]),
      /mismatched formats/,
    );
  });
});

describe("podcast media pipeline", () => {
  it("synthesizes both hosts via the local provider into one wav episode", async () => {
    const result = await generatePodcastAudio({
      turns: [
        { speaker: "HOST_A", text: "Opening claim." },
        { speaker: "HOST_B", text: "Challenging that." },
      ],
    });
    assert.equal(result.format, "wav");
    assert.equal(result.provider, "local");
    assert.equal(result.segments, 2);
    const info = parseWavHeader(result.audio);
    assert.ok(info);
    assert.equal(result.durationSeconds, info.dataBytes / (info.sampleRate * 2));
    assert.ok(result.durationSeconds > 0);
  });

  it("synthesizes deterministically for the same turns", async () => {
    const turns = [
      { speaker: "HOST_A" as const, text: "Same episode." },
      { speaker: "HOST_B" as const, text: "Same episode." },
    ];
    const first = await generatePodcastAudio({ turns });
    const second = await generatePodcastAudio({ turns });
    assert.deepEqual(first.audio, second.audio);
    assert.equal(first.durationSeconds, second.durationSeconds);
  });

  it("routes mp3 provider output through assembly with a null duration", async () => {
    const fakeElevenLabs: TTSProvider = {
      type: "elevenlabs",
      async synthesize() {
        return { audio: Buffer.from("Id3fake"), format: "mp3", durationSeconds: null, provider: "elevenlabs" };
      },
    };
    const previousA = process.env[ELEVENLABS_VOICE_HOST_A_ENV];
    const previousB = process.env[ELEVENLABS_VOICE_HOST_B_ENV];
    process.env[ELEVENLABS_VOICE_HOST_A_ENV] = "voice-a";
    process.env[ELEVENLABS_VOICE_HOST_B_ENV] = "voice-b";
    try {
      const result = await generatePodcastAudio({
        turns: [
          { speaker: "HOST_A", text: "One" },
          { speaker: "HOST_B", text: "Two" },
        ],
        provider: fakeElevenLabs,
      });
      assert.equal(result.format, "mp3");
      assert.equal(result.provider, "elevenlabs");
      assert.equal(result.durationSeconds, null);
      assert.equal(result.segments, 2);
    } finally {
      if (previousA === undefined) delete process.env[ELEVENLABS_VOICE_HOST_A_ENV];
      else process.env[ELEVENLABS_VOICE_HOST_A_ENV] = previousA;
      if (previousB === undefined) delete process.env[ELEVENLABS_VOICE_HOST_B_ENV];
      else process.env[ELEVENLABS_VOICE_HOST_B_ENV] = previousB;
    }
  });

  it("fails atomically on empty turns", async () => {
    await assert.rejects(generatePodcastAudio({ turns: [] }), /no turns to synthesize/);
  });

  it("maps local voices to deterministic seeds and elevenlabs voices to env ids", () => {
    assert.equal(resolveSpeakerVoiceId("HOST_A", "local"), PODCAST_VOICE_HOST_A);
    assert.equal(resolveSpeakerVoiceId("HOST_B", "local"), PODCAST_VOICE_HOST_B);
    assert.notEqual(PODCAST_VOICE_HOST_A, PODCAST_VOICE_HOST_B);

    const previousA = process.env[ELEVENLABS_VOICE_HOST_A_ENV];
    const previousB = process.env[ELEVENLABS_VOICE_HOST_B_ENV];
    delete process.env[ELEVENLABS_VOICE_HOST_A_ENV];
    delete process.env[ELEVENLABS_VOICE_HOST_B_ENV];
    try {
      assert.throws(() => resolveSpeakerVoiceId("HOST_A", "elevenlabs"), new RegExp(`${ELEVENLABS_VOICE_HOST_A_ENV} is not configured`));
    } finally {
      if (previousA === undefined) delete process.env[ELEVENLABS_VOICE_HOST_A_ENV];
      else process.env[ELEVENLABS_VOICE_HOST_A_ENV] = previousA;
      if (previousB === undefined) delete process.env[ELEVENLABS_VOICE_HOST_B_ENV];
      else process.env[ELEVENLABS_VOICE_HOST_B_ENV] = previousB;
    }

    process.env[ELEVENLABS_VOICE_HOST_A_ENV] = "real-host-a";
    process.env[ELEVENLABS_VOICE_HOST_B_ENV] = "real-host-b";
    try {
      assert.equal(resolveSpeakerVoiceId("HOST_A", "elevenlabs"), "real-host-a");
      assert.equal(resolveSpeakerVoiceId("HOST_B", "elevenlabs"), "real-host-b");
    } finally {
      if (previousA === undefined) delete process.env[ELEVENLABS_VOICE_HOST_A_ENV];
      else process.env[ELEVENLABS_VOICE_HOST_A_ENV] = previousA;
      if (previousB === undefined) delete process.env[ELEVENLABS_VOICE_HOST_B_ENV];
      else process.env[ELEVENLABS_VOICE_HOST_B_ENV] = previousB;
    }
  });

  it("keeps pipeline code free of storage, actions, and engine imports", () => {
    const source = readFileSync(new URL("../lib/audio/pipeline.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["']@\/lib\/(storage|actions|engine)/);
    assert.match(source, /generatePodcastAudio/);
  });

  it("the local provider remains the default fixture provider", () => {
    assert.equal(new LocalTTSProvider().type, "local");
  });
});