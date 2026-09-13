export type { TTSProvider, TTSRequest, TTSResult, TTSProviderType, AudioFormat } from "./types";
export {
  LocalTTSProvider,
  buildLocalWav,
  parseWavHeader,
  wavDurationSeconds,
  LOCAL_TTS_SAMPLE_RATE,
  LOCAL_TTS_BITS_PER_SAMPLE,
  LOCAL_TTS_LEAD_IN_SAMPLES,
  LOCAL_TTS_SAMPLES_PER_CHAR,
} from "./providers/local";
export type { WavInfo } from "./providers/local";
export { TTS_PROVIDER_ENV, getTTSProvider, resolveTTSProviderType } from "./providers/index";
export {
  ElevenLabsTTSProvider,
  createElevenLabsProvider,
  ELEVENLABS_API_URL,
  ELEVENLABS_API_KEY_ENV,
  ELEVENLABS_VOICE_HOST_A_ENV,
  ELEVENLABS_VOICE_HOST_B_ENV,
} from "./providers/elevenlabs";
export {
  assemblePodcastSegments,
  PODCAST_TURN_PAUSE_SECONDS,
} from "./assembly";
export type { AudioSegment, AssembledAudio } from "./assembly";
export {
  generatePodcastAudio,
  resolveSpeakerVoiceId,
  PODCAST_VOICE_HOST_A,
  PODCAST_VOICE_HOST_B,
} from "./pipeline";
export type { PodcastSynthesisInput, PodcastSynthesisResult } from "./pipeline";