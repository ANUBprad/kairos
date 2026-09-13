// Pure state contract for interruption playback in the podcast viewer.
// The viewer swaps the same <audio> element to an interruption asset, then on
// end (natural or user-stopped) returns the element to the episode and resumes
// only if the episode was actually playing when the interruption started. A
// user activity during the interruption (e.g. pausing it) is honoured: we never
// force-resume audio someone explicitly paused.
export type InterruptionPlaybackPhase = "idle" | "interruption";

export interface InterruptionPlaybackState {
  phase: InterruptionPlaybackPhase;
  activeInterruptionId: string | null;
  originalCurrentTime: number | null;
  originalWasPlaying: boolean;
}

export const IDLE_INTERRUPTION_PLAYBACK: InterruptionPlaybackState = {
  phase: "idle",
  activeInterruptionId: null,
  originalCurrentTime: null,
  originalWasPlaying: false,
};

export interface PlaybackIntent {
  seekTo: number | null;
  resume: boolean;
}

export function startInterruption(
  state: InterruptionPlaybackState,
  interruptionId: string,
  original: { currentTime: number; wasPlaying: boolean },
): InterruptionPlaybackState {
  return {
    phase: "interruption",
    activeInterruptionId: interruptionId,
    originalCurrentTime: original.currentTime,
    originalWasPlaying: original.wasPlaying,
  };
}

// Idempotent: only an active interruption can produce an intent; a stray end
// event after we already returned keeps the player idle and emits nothing.
export function endInterruptionPlayback(state: InterruptionPlaybackState): {
  intent: PlaybackIntent;
  next: InterruptionPlaybackState;
} {
  if (state.phase !== "interruption") {
    return { intent: { seekTo: null, resume: false }, next: state };
  }
  return {
    intent: {
      seekTo: state.originalCurrentTime,
      resume: state.originalWasPlaying,
    },
    next: IDLE_INTERRUPTION_PLAYBACK,
  };
}