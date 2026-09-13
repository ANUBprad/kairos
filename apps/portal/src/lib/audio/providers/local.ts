import type { TTSProvider, TTSRequest, TTSResult } from "../types";

// Deterministic, dependency-free fixture speech synthesizer. It emits a real,
// playable WAV (mono 16-bit PCM) whose frequency is derived from the voice id
// and whose length is derived from the text — so tests can exercise the TTS
// contract without any credentials, network access, or speech model. It is
// intentionally not human speech; it is the non-production provider.
export const LOCAL_TTS_SAMPLE_RATE = 16000;
export const LOCAL_TTS_BITS_PER_SAMPLE = 16;
export const LOCAL_TTS_LEAD_IN_SAMPLES = 400;
export const LOCAL_TTS_SAMPLES_PER_CHAR = 800;

export interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
}

// Parses the standard 44+-byte RIFF/WAVE header. Null when the buffer is not a
// linear PCM WAV, so malformed segments fail loudly in assembly instead of
// being concatenated blindly.
export function parseWavHeader(buffer: Buffer): WavInfo | null {
  if (buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return null;
  const dataPos = buffer.indexOf("data", 12);
  if (dataPos === -1 || dataPos + 8 > buffer.length) return null;
  if (buffer.readUInt16LE(20) !== 1) return null;
  return {
    channels: buffer.readUInt16LE(22),
    sampleRate: buffer.readUInt32LE(24),
    bitsPerSample: buffer.readUInt16LE(34),
    dataBytes: buffer.readUInt32LE(dataPos + 4),
  };
}

// Exact duration of a linear PCM WAV, derived from the header, or null when
// the buffer is not a WAV it recognises.
export function wavDurationSeconds(buffer: Buffer): number | null {
  const info = parseWavHeader(buffer);
  if (!info) return null;
  const bytesPerSecond = info.sampleRate * info.channels * (info.bitsPerSample / 8);
  return bytesPerSecond > 0 ? info.dataBytes / bytesPerSecond : null;
}

// A stable voice-specific tone frequency in the 220–440 Hz range.
function voiceTone(voiceId: string): number {
  let hash = 0;
  for (const ch of voiceId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 220 + (hash % 220);
}

function buildWavHeader(dataBytes: number): Buffer {
  const sampleRate = LOCAL_TTS_SAMPLE_RATE;
  const byteRate = sampleRate * 1 * (LOCAL_TTS_BITS_PER_SAMPLE / 8);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(LOCAL_TTS_BITS_PER_SAMPLE, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

export function buildLocalWav(voiceId: string, text: string): Buffer {
  const totalSamples = LOCAL_TTS_LEAD_IN_SAMPLES + LOCAL_TTS_SAMPLES_PER_CHAR * text.length;
  const tone = voiceTone(voiceId);
  const pcm = Buffer.alloc(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * tone * i) / LOCAL_TTS_SAMPLE_RATE) * 4000);
    pcm.writeInt16LE(sample, i * 2);
  }
  return Buffer.concat([buildWavHeader(pcm.length), pcm]);
}

export class LocalTTSProvider implements TTSProvider {
  readonly type = "local";

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error("TTS text must not be empty");
    }
    const audio = buildLocalWav(request.voiceId, request.text);
    return {
      audio,
      format: "wav",
      durationSeconds: wavDurationSeconds(audio),
      provider: "local",
    };
  }
}