import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  IDLE_INTERRUPTION_PLAYBACK,
  endInterruptionPlayback,
  startInterruption,
} from "@/lib/audio/playback";

describe("interruption playback reducer", () => {
  it("starts an interruption with the episode's exact playback anchor", () => {
    const next = startInterruption(IDLE_INTERRUPTION_PLAYBACK, "int_1", {
      currentTime: 42.25,
      wasPlaying: true,
    });
    assert.equal(next.phase, "interruption");
    assert.equal(next.activeInterruptionId, "int_1");
    assert.equal(next.originalCurrentTime, 42.25);
    assert.equal(next.originalWasPlaying, true);
  });

  it("returns to the episode and resumes only if it was playing", () => {
    const during = startInterruption(IDLE_INTERRUPTION_PLAYBACK, "int_1", {
      currentTime: 12,
      wasPlaying: true,
    });
    const { intent, next } = endInterruptionPlayback(during);
    assert.deepEqual(intent, { seekTo: 12, resume: true });
    assert.deepEqual(next, IDLE_INTERRUPTION_PLAYBACK);
  });

  it("never force-resumes an episode the user had paused", () => {
    const during = startInterruption(IDLE_INTERRUPTION_PLAYBACK, "int_1", {
      currentTime: 5,
      wasPlaying: false,
    });
    const { intent } = endInterruptionPlayback(during);
    assert.deepEqual(intent, { seekTo: 5, resume: false });
  });

  it("restores a stopped position even when the episode was silent", () => {
    const during = startInterruption(IDLE_INTERRUPTION_PLAYBACK, "int_1", {
      currentTime: 0.5,
      wasPlaying: false,
    });
    const { intent } = endInterruptionPlayback(during);
    assert.deepEqual(intent, { seekTo: 0.5, resume: false });
  });

  it("ignores a second end event after the player already returned", () => {
    const returned = endInterruptionPlayback(IDLE_INTERRUPTION_PLAYBACK);
    assert.deepEqual(returned, {
      intent: { seekTo: null, resume: false },
      next: IDLE_INTERRUPTION_PLAYBACK,
    });
  });

  it("handles a user-stop during an interruption like a natural end", () => {
    const during = startInterruption(IDLE_INTERRUPTION_PLAYBACK, "int_1", {
      currentTime: 30,
      wasPlaying: true,
    });
    const stopped = endInterruptionPlayback(during);
    assert.deepEqual(stopped.intent, { seekTo: 30, resume: true });
    assert.equal(stopped.next.phase, "idle");
  });
});