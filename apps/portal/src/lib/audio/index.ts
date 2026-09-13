export type { TTSProvider, TTSRequest, TTSResult, TTSProviderType, AudioFormat } from "./types";
export {
  LocalTTSProvider,
  parseWavHeader,
  wavDurationSeconds,
  LOCAL_TTS_SAMPLE_RATE,
  LOCAL_TTS_BITS_PER_SAMPLE,
  LOCAL_TTS_LEAD_IN_SAMPLES,
  LOCAL_TTS_SAMPLES_PER_CHAR,
} from "./providers/local";
export type { WavInfo } from "./providers/local";
export { TTS_PROVIDER_ENV, getTTSProvider, resolveTTSProviderType } from "./providers/index";