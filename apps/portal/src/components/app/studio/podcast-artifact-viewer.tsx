"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  FileText,
  Loader2,
  MessageCircleQuestion,
  Play,
  Podcast,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { resolveSourceProvenance } from "@/lib/artifacts/summary-view";
import { parsePodcastContent, parsePodcastAudioMetadata } from "@/lib/artifacts/podcast-view";
import { PODCAST_HOST_PERSONAS } from "@/lib/artifacts/podcast";
import { askPodcastInterruption } from "@/lib/actions/podcast-interrupt";
import {
  parseClientInterruptions,
  type PodcastInterruptionView,
} from "@/lib/artifacts/interrupt-view";
import {
  IDLE_INTERRUPTION_PLAYBACK,
  endInterruptionPlayback,
  startInterruption,
  type InterruptionPlaybackState,
} from "@/lib/audio/playback";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function interruptionMediaUrl(artifactId: string, interruptionId: string): string {
  return `/api/artifacts/${artifactId}/audio/interruption/${interruptionId}`;
}

export function PodcastArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parsePodcastContent(artifact.content);
  const audio = parsePodcastAudioMetadata(artifact.metadata);
  const provenance = resolveSourceProvenance(artifact.sourceIds, sources);
  const canInterrupt = artifact.status === "COMPLETED";

  const audioRef = useRef<HTMLAudioElement>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [interruptions, setInterruptions] = useState<PodcastInterruptionView[]>(() =>
    parseClientInterruptions(artifact.metadata),
  );
  const [playback, setPlayback] = useState<InterruptionPlaybackState>(IDLE_INTERRUPTION_PLAYBACK);

  function playInterruption(view: PodcastInterruptionView) {
    const el = audioRef.current;
    if (!el || view.id === playback.activeInterruptionId) {
      return;
    }
    setPlayback(
      startInterruption(playback, view.id, {
        currentTime: el.currentTime || 0,
        wasPlaying: !el.paused,
      }),
    );
    el.src = interruptionMediaUrl(artifact.id, view.id);
    el.load();
    void el.play().catch(() => {});
  }

  function returnToEpisode() {
    if (playback.phase !== "interruption") {
      return;
    }
    const el = audioRef.current;
    if (!el) {
      return;
    }
    const { intent, next } = endInterruptionPlayback(playback);
    setPlayback(next);
    el.src = `/api/artifacts/${artifact.id}/audio`;
    el.load();
    if (intent.seekTo != null && intent.seekTo >= 0) {
      el.currentTime = intent.seekTo;
    }
    if (intent.resume) {
      void el.play().catch(() => {});
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking || !canInterrupt) {
      return;
    }
    setAsking(true);
    setAskError(null);
    try {
      const view = await askPodcastInterruption(artifact.id, artifact.knowledgeBaseId, trimmed);
      setQuestion("");
      setInterruptions((history) => [view, ...history]);
    } catch (error) {
      setAskError(error instanceof Error ? error.message : "Failed to generate an answer.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Podcast artifact">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Podcast size={16} className="text-brand" />
            <h2 className="truncate text-base font-semibold text-text-primary">
              {artifact.name || "Untitled podcast"}
            </h2>
            <ArtifactStatusBadge status={artifact.status} />
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            {new Date(artifact.createdAt).toLocaleString()}
            {artifact.sourceIds.length > 0 &&
              ` · ${artifact.sourceIds.length} source${artifact.sourceIds.length !== 1 ? "s" : ""}`}
            {canInterrupt && audio?.durationSeconds != null && (
              ` · ${formatDuration(audio.durationSeconds)}`
            )}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>

      <div className="p-5">
        {artifact.status === "PENDING" && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin text-text-tertiary" />
            Waiting to be processed.
          </div>
        )}

        {artifact.status === "PROCESSING" && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin text-text-tertiary" />
            This podcast is still being generated.
          </div>
        )}

        {artifact.status === "FAILED" && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>This podcast failed to generate. You can try again from a new source selection.</p>
          </div>
        )}

        {canInterrupt &&
          (playback.phase === "interruption" ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-brand bg-brand/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <MessageCircleQuestion size={16} className="shrink-0 text-brand" />
                <span className="truncate">Answering your question…</span>
              </div>
              <Button variant="outline" size="sm" onClick={returnToEpisode}>
                <RotateCcw size={14} />
                Return to episode
              </Button>
            </div>
          ) : (
            <div>
              <form onSubmit={handleAsk} className="flex items-start gap-2">
                <label htmlFor="podcast-question" className="sr-only">
                  Ask a question about this podcast
                </label>
                <input
                  id="podcast-question"
                  type="text"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question while it plays…"
                  className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-brand"
                  maxLength={300}
                  disabled={asking}
                />
                <Button type="submit" size="sm" disabled={asking || !question.trim()}>
                  {asking ? <Loader2 size={14} className="animate-spin" /> : "Ask"}
                </Button>
              </form>
              {askError && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-error">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {askError}
                </p>
              )}
              {interruptions.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {interruptions.map((interruption) => (
                    <li
                      key={interruption.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-text-primary">{interruption.question}</p>
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          {new Date(interruption.createdAt).toLocaleString()}
                          {interruption.durationSeconds != null &&
                            ` · ${formatDuration(interruption.durationSeconds)}`}
                        </p>
                      </div>
                      {interruption.audioAvailable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playInterruption(interruption)}
                          disabled={playback.activeInterruptionId === interruption.id}
                        >
                          <Play size={14} />
                          {playback.activeInterruptionId === interruption.id ? "Playing" : "Play"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

        {canInterrupt &&
          (!content ? (
            <div className="mt-4 flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
              <p>This podcast&apos;s content is unavailable to display.</p>
            </div>
          ) : (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{content.summary}</p>

              {audio ? (
                <div className="mt-4">
                  <audio
                    ref={audioRef}
                    controls
                    preload="none"
                    className="w-full"
                    src={`/api/artifacts/${artifact.id}/audio`}
                    onEnded={returnToEpisode}
                    aria-label="Podcast audio player"
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-2 text-sm text-text-secondary">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
                  <p>Playback for this podcast is unavailable.</p>
                </div>
              )}

              <div className="mt-5 border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Transcript
                </h4>
                <ol className="mt-2 space-y-3">
                  {content.turns.map((turn, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                        {PODCAST_HOST_PERSONAS[turn.speaker].name}
                      </span>
                      <p className="text-sm leading-relaxed text-text-secondary">{turn.text}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Sources
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {provenance.map((ref) => (
                    <li key={ref.id} className="flex items-center gap-2 text-sm text-text-secondary">
                      <FileText size={13} className="shrink-0 text-text-tertiary" />
                      <span className="truncate">{ref.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

        {!canInterrupt && artifact.status === "COMPLETED" && (
          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
            <p>This podcast&apos;s content is unavailable to display.</p>
          </div>
        )}
      </div>
    </section>
  );
}