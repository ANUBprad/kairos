import { parseWavHeader } from "./providers/local";

// Fixed silent gap inserted between spoken turns so adjacent speakers do not
// run into each other in the assembled episode.
export const PODCAST_TURN_PAUSE_SECONDS = 0.35;

export interface AudioSegment {
  audio: Buffer;
  format: "wav" | "mp3";
}

export interface AssembledAudio {
  audio: Buffer;
  format: "wav" | "mp3";
  durationSeconds: number | null;
}

interface WavSegment extends AudioSegment {
  format: "wav";
}

// Combines per-turn speech into one playable episode. WAV is assembled by
// stripping each segment header and joining PCM frames with a pause gap, so
// the resulting duration is exact. MP3 (reported-duration unknown) is joined
// byte-for-byte and duration stays null rather than fabricated.
export function assemblePodcastSegments(segments: AudioSegment[]): AssembledAudio {
  if (segments.length === 0) throw new Error("Podcast has no spoken turns to assemble");

  const hasMp3 = segments.some((s) => s.format === "mp3");
  const hasWav = segments.some((s) => s.format === "wav");
  if (hasMp3 && hasWav) {
    throw new Error("Cannot assemble a podcast from mixed WAV and MP3 segments; use a single TTS provider");
  }

  if (hasMp3) {
    // ponytail: naive MP3 byte concatenation; plays in common browsers but a
    // decoder-level seam can sit between turns. Upgrade path: a real muxer
    // (e.g. ffmpeg-wasm) only if audible artifacts show up in playback.
    const zeroLength = segments.find((s) => s.audio.length === 0);
    if (zeroLength) throw new Error("Empty audio segment cannot be assembled");
    return {
      audio: Buffer.concat(segments.map((s) => s.audio)),
      format: "mp3",
      durationSeconds: null,
    };
  }

  return assembleWavSegments(segments as WavSegment[]);
}

function assembleWavSegments(segments: WavSegment[]): AssembledAudio {
  const infos = segments.map((s) => {
    const info = parseWavHeader(s.audio);
    if (!info) throw new Error("Segment is not a linear PCM WAV and cannot be assembled");
    return info;
  });

  const reference = infos[0]!;
  for (const info of infos) {
    if (
      info.sampleRate !== reference.sampleRate ||
      info.channels !== reference.channels ||
      info.bitsPerSample !== reference.bitsPerSample
    ) {
      throw new Error("Cannot assemble WAV segments with mismatched formats");
    }
  }

  const bytesPerSample = reference.channels * (reference.bitsPerSample / 8);
  const pauseBytes = Math.round(reference.sampleRate * PODCAST_TURN_PAUSE_SECONDS) * bytesPerSample;
  const pause = Buffer.alloc(Math.max(pauseBytes, 0));

  const parts: Buffer[] = [];
  segments.forEach((segment, index) => {
    if (index > 0) parts.push(pause);
    const info = infos[index]!;
    const dataEnd = Math.min(segment.audio.length, info.dataOffset + info.dataBytes);
    parts.push(segment.audio.subarray(info.dataOffset, dataEnd));
  });

  const pcm = Buffer.concat(parts);
  const durationSeconds = pcm.length / (reference.sampleRate * bytesPerSample);

  return { audio: buildWavHeader(pcm.length, reference), format: "wav", durationSeconds };
}

function buildWavHeader(dataBytes: number, reference: WavInfoLike): Buffer {
  const sampleRate = reference.sampleRate;
  const channels = reference.channels;
  const bitsPerSample = reference.bitsPerSample;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

type WavInfoLike = NonNullable<ReturnType<typeof parseWavHeader>>;