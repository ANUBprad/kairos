"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Copy,
  Check,
  Radio,
  User,
  Users,
  MessageCircleQuestion,
  Loader2,
  X,
  Send,
} from "lucide-react";
import { AudioLinesIcon } from "@/components/ui/audio-lines";
import { PodcastContent, InterruptionItem } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { dismissOnBackdropClick } from "@/lib/modal";

interface PodcastViewerProps {
  content?: { podcast?: PodcastContent } | null;
  artifactId?: string;
  workspaceId?: string;
}

const SUGGESTED_INTERRUPTIONS = [
  "Can you give a concrete real-world example of this?",
  "What are the biggest trade-offs or limitations mentioned?",
  "How does this connect to earlier findings in the sources?",
  "Could you summarize the main takeaway in simpler terms?",
];

const PLAYBACK_RATES = [1, 1.25, 1.5, 2];

function formatTime(seconds: number) {
  if (Number.isNaN(seconds)) return "00:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function getTranscriptText(turns: PodcastContent["transcript"] = []) {
  return turns.map((turn) => `${turn.speaker.toUpperCase()}:\n${turn.text}`).join("\n\n");
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

export function resolvePodcastAudioUrl(
  rawUrl?: string | null,
  workspaceId?: string,
  artifactId?: string,
  interruptionId?: string
): string | undefined {
  if (interruptionId && workspaceId && artifactId) {
    if (
      rawUrl &&
      (rawUrl.startsWith("https://res.cloudinary.com") ||
        (rawUrl.startsWith("https://") && !rawUrl.includes("localhost")))
    ) {
      return rawUrl;
    }
    return `${API_BASE_URL}/api/audio/${workspaceId}/${artifactId}?interruptionId=${interruptionId}`;
  }

  if (!rawUrl) {
    if (workspaceId && artifactId) {
      return `${API_BASE_URL}/api/audio/${workspaceId}/${artifactId}`;
    }
    return undefined;
  }

  // Direct Cloudinary or HTTPS CDN
  if (
    rawUrl.startsWith("https://res.cloudinary.com") ||
    (rawUrl.startsWith("https://") && !rawUrl.includes("localhost"))
  ) {
    return rawUrl;
  }

  // If local URL saved in DB (e.g. http://localhost:8081/...)
  if (rawUrl.includes("localhost:8081")) {
    if (workspaceId && artifactId) {
      return `${API_BASE_URL}/api/audio/${workspaceId}/${artifactId}`;
    }
    return rawUrl.replace("http://localhost:8081", API_BASE_URL);
  }

  // If relative path
  if (rawUrl.startsWith("/")) {
    return `${API_BASE_URL}${rawUrl}`;
  }

  return rawUrl;
}

export function PodcastViewer({
  content,
  artifactId,
  workspaceId,
}: PodcastViewerProps) {
  const podcast = content?.podcast;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Interruption State
  const [createdInterruptions, setCreatedInterruptions] = useState<InterruptionItem[]>([]);
  const [isInterruptModalOpen, setIsInterruptModalOpen] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");
  const [isSubmittingInterrupt, setIsSubmittingInterrupt] = useState(false);
  const [interruptError, setInterruptError] = useState<string | null>(null);

  // Active playing interruption & resume queue
  const [activeInterruption, setActiveInterruption] =
    useState<InterruptionItem | null>(null);
  const [savedResumeTime, setSavedResumeTime] = useState<number>(0);

  const turns = podcast?.transcript || [];
  const rawMainAudioUrl = podcast?.audioUrl;

  const resolvedMainAudioUrl = useMemo(
    () => resolvePodcastAudioUrl(rawMainAudioUrl, workspaceId, artifactId),
    [rawMainAudioUrl, workspaceId, artifactId]
  );

  const resolvedActiveInterruptionUrl = useMemo(
    () =>
      resolvePodcastAudioUrl(
        activeInterruption?.audioUrl,
        workspaceId,
        artifactId,
        activeInterruption?.id
      ),
    [activeInterruption, workspaceId, artifactId]
  );

  const currentAudioSrc = resolvedActiveInterruptionUrl || resolvedMainAudioUrl;

  const interruptions = useMemo(() => {
    const persisted = podcast?.interruptions ?? [];
    const persistedIds = new Set(persisted.map((item) => item.id));
    return [...persisted, ...createdInterruptions.filter((item) => !persistedIds.has(item.id))];
  }, [podcast?.interruptions, createdInterruptions]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      // If an interruption was playing, resume the main podcast seamlessly
      if (activeInterruption) {
        setActiveInterruption(null);
        if (resolvedMainAudioUrl) {
          audio.src = resolvedMainAudioUrl;
          audio.currentTime = savedResumeTime;
          audio
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    };

    const handleError = () => {
      console.warn("Audio element encountered an error loading source:", audio.src);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [activeInterruption, resolvedMainAudioUrl, savedResumeTime]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    setPlaybackError(null);
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Ensure audio src is loaded
      if (!audioRef.current.src && currentAudioSrc) {
        audioRef.current.src = currentAudioSrc;
      }
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error("Audio playback error:", err);
          setIsPlaying(false);
          setPlaybackError(
            "Unable to play audio stream. Please check network connection or verify audio URL."
          );
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const skipTime = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.min(
      Math.max(audioRef.current.currentTime + seconds, 0),
      duration || 9999
    );
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
    const nextRate =
      PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const copyTranscript = () => {
    const text = getTranscriptText(turns);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open "Interrupt & Ask" modal — pauses the audio and saves timestamp
  const handleOpenInterrupt = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setSavedResumeTime(audioRef.current.currentTime);
    } else {
      setSavedResumeTime(currentTime);
    }
    setInterruptError(null);
    setIsInterruptModalOpen(true);
  };

  // Submit interruption question to AI hosts
  const handleSendInterruption = async (questionToSend?: string) => {
    const q = (questionToSend || userQuestion).trim();
    if (!q || !artifactId || !workspaceId) return;

    setIsSubmittingInterrupt(true);
    setInterruptError(null);

    try {
      const interruption = await apiClient<InterruptionItem>(
        `/api/workspaces/${workspaceId}/artifacts/${artifactId}/podcast/interrupt`,
        {
          method: "POST",
          body: JSON.stringify({
            question: q,
            timestamp: savedResumeTime,
          }),
        }
      );

      setCreatedInterruptions((previous) => [...previous, interruption]);
      setUserQuestion("");
      setIsInterruptModalOpen(false);

      // Play the interruption audio immediately
      const intUrl = resolvePodcastAudioUrl(
        interruption.audioUrl,
        workspaceId,
        artifactId,
        interruption.id
      );

      if (intUrl && audioRef.current) {
        setActiveInterruption(interruption);
        audioRef.current.src = intUrl;
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to generate host response. Please try again.";
      setInterruptError(msg);
    } finally {
      setIsSubmittingInterrupt(false);
    }
  };

  // Skip active interruption and resume main podcast immediately
  const handleSkipInterruption = () => {
    if (!audioRef.current) return;
    setActiveInterruption(null);
    if (resolvedMainAudioUrl) {
      audioRef.current.src = resolvedMainAudioUrl;
      audioRef.current.currentTime = savedResumeTime;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Replay a specific interruption from the transcript
  const handlePlayInterruption = (item: InterruptionItem) => {
    const itemUrl = resolvePodcastAudioUrl(
      item.audioUrl,
      workspaceId,
      artifactId,
      item.id
    );
    if (!itemUrl || !audioRef.current) return;
    if (audioRef.current) {
      setSavedResumeTime(audioRef.current.currentTime);
      setActiveInterruption(item);
      audioRef.current.src = itemUrl;
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  if (!podcast || turns.length === 0) {
    return (
      <div className="kairos-inset space-y-2 px-5 py-8 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Radio className="size-5 animate-pulse motion-reduce:animate-none" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Podcast audio isn’t available yet
        </p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          The episode will appear here once generation finishes.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      {/* Hidden audio element */}
      {/* Keep this a no-CORS media request: it sends the session cookie to our
          authenticated API, while direct Cloudinary redirects do not need to
          return CORS headers. */}
      <audio
        ref={audioRef}
        src={currentAudioSrc}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Podcast Audio Player Hero Card */}
      <section className="kairos-panel space-y-4 p-5 sm:p-6">
        {/* Header & Status */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="kairos-inset flex size-10 shrink-0 items-center justify-center rounded-xl text-primary">
              <AudioLinesIcon size={20} />
            </div>
            <div className="min-w-0">
              <p className="kairos-eyebrow">Now playing</p>
              <h3 className="kairos-section-title mt-1 text-base sm:text-lg">
                {podcast.topic || "AI deep-dive debate podcast"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Hosted by <strong className="text-foreground">Alex</strong> (analyst) &amp;{" "}
                <strong className="text-foreground">Jordan</strong> (challenger)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Interrupt & Ask Action Button */}
            {artifactId && workspaceId && (
              <Button
                variant="default"
                size="xs"
                onClick={handleOpenInterrupt}
                className="gap-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-panel)] transition-all hover:opacity-90 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                title="Pause episode and ask Alex & Jordan a question"
              >
                <Radio className="size-3.5 text-danger animate-pulse motion-reduce:animate-none" />
                <span>Interrupt &amp; Ask</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="xs"
              onClick={copyTranscript}
              className="gap-1 rounded-full text-xs"
              title="Copy entire debate transcript"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-success" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Transcript</span>
                </>
              )}
            </Button>

            {resolvedMainAudioUrl && (
              <a
                href={resolvedMainAudioUrl}
                download="kairos-debate-podcast.mp3"
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="xs" className="gap-1 rounded-full text-xs">
                  <Download className="size-3.5" />
                  <span>MP3</span>
                </Button>
              </a>
            )}
          </div>
        </div>

        {playbackError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
          >
            <span>{playbackError}</span>
            <button
              type="button"
              onClick={() => setPlaybackError(null)}
              aria-label="Dismiss playback error"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Active Interruption Live Overlay */}
        {activeInterruption && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-xs animate-fadeIn motion-reduce:animate-none">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="shrink-0 rounded-full bg-warning/20 p-1 text-warning">
                <Radio className="size-3.5 animate-pulse motion-reduce:animate-none" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-warning">
                  Host Q&amp;A: &ldquo;{activeInterruption.userQuestion}&rdquo;
                </span>
                <span className="text-[11px] text-warning/80">
                  Alex &amp; Jordan are answering · The episode resumes next
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSkipInterruption}
              className="shrink-0 rounded-full bg-warning/20 px-3 py-1 text-[11px] font-medium text-warning transition-colors hover:bg-warning/30 motion-reduce:transition-none"
            >
              Resume episode
            </button>
          </div>
        )}

        {/* Animated Sound Wave Visualizer */}
        <div
          aria-hidden="true"
          className="flex h-10 w-full items-center justify-center gap-1 overflow-hidden rounded-xl border border-border/60 bg-brand-quiet px-4"
        >
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1 rounded-full transition-all duration-150 motion-reduce:transition-none",
                activeInterruption
                  ? "bg-warning"
                  : "bg-primary/70",
                isPlaying ? "animate-pulse motion-reduce:animate-none" : "opacity-40"
              )}
              style={{
                height: isPlaying
                  ? `${Math.max(15, Math.sin(i + currentTime * 3) * 80 + 20)}%`
                  : `${(i % 5) * 15 + 15}%`,
                animationDelay: `${(i % 8) * 100}ms`,
              }}
            />
          ))}
        </div>

        {/* Progress Bar & Timestamps */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!resolvedMainAudioUrl && !activeInterruption}
            aria-label="Podcast playback position"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary disabled:opacity-50"
          />
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>
              {activeInterruption
                ? `Q&A (${formatTime(duration)})`
                : duration > 0
                ? formatTime(duration)
                : podcast.durationEstimate || "~1:00"}
            </span>
          </div>
        </div>

        {/* Player Controls Bar */}
        <div className="flex items-center justify-between pt-1">
          {/* Volume toggle */}
          <button
            type="button"
            onClick={toggleMute}
            disabled={!resolvedMainAudioUrl && !activeInterruption}
            aria-label={isMuted ? "Unmute podcast" : "Mute podcast"}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground disabled:opacity-40 motion-reduce:transition-none"
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>

          {/* Center Playback Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => skipTime(-10)}
              disabled={!resolvedMainAudioUrl && !activeInterruption}
              aria-label="Rewind 10 seconds"
              className="rounded-full p-2 text-muted-foreground transition-all hover:bg-brand-soft hover:text-foreground active:scale-95 disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="size-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={!resolvedMainAudioUrl && !activeInterruption}
              aria-label={isPlaying ? "Pause podcast" : "Play podcast"}
              className="rounded-full bg-primary p-3.5 text-primary-foreground shadow-[var(--shadow-panel)] transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
              title={isPlaying ? "Pause" : "Play Podcast"}
            >
              {isPlaying ? (
                <Pause className="size-5 fill-primary-foreground" />
              ) : (
                <Play className="size-5 translate-x-0.5 fill-primary-foreground" />
              )}
            </button>

            <button
              type="button"
              onClick={() => skipTime(10)}
              disabled={!resolvedMainAudioUrl && !activeInterruption}
              aria-label="Fast forward 10 seconds"
              className="rounded-full p-2 text-muted-foreground transition-all hover:bg-brand-soft hover:text-foreground active:scale-95 disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
              title="Fast forward 10 seconds"
            >
              <RotateCw className="size-4" />
            </button>
          </div>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={cyclePlaybackRate}
            disabled={!resolvedMainAudioUrl && !activeInterruption}
            aria-label={`Playback speed ${playbackRate}x`}
            className="rounded-full border border-border bg-brand-quiet px-2.5 py-1 font-mono text-xs font-semibold text-foreground transition-colors hover:bg-brand-soft disabled:opacity-40 motion-reduce:transition-none"
          >
            {playbackRate}x
          </button>
        </div>
      </section>

      {/* Podcast Summary Banner */}
      {podcast.summary && (
        <div className="kairos-inset space-y-1.5 px-4 py-3.5 text-xs leading-relaxed text-muted-foreground">
          <p className="kairos-eyebrow">Episode synopsis</p>
          <p>{podcast.summary}</p>
        </div>
      )}

      {/* Interactive Multi-Speaker Debate Transcript with Interruption Badges */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="kairos-eyebrow flex items-center gap-1.5">
              <Users className="size-3.5" />
              Debate transcript
            </p>
            <h4 className="kairos-section-title mt-1 text-sm">
              {turns.length} {turns.length === 1 ? "exchange" : "exchanges"}
            </h4>
          </div>
          {interruptions.length > 0 && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Radio className="size-3 text-danger" />
              <span>{interruptions.length} listener Q&amp;A</span>
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {turns.map((turn, index) => {
            const isAlex = turn.speaker === "Alex";
            // Check if any interruption happened around this point
            const matchingInterruption = interruptions.find(
              (it) => Math.floor(it.timestamp / 10) === index
            );

            return (
              <React.Fragment key={index}>
                <div
                  className={cn(
                    "rounded-2xl border p-4 transition-colors motion-reduce:transition-none",
                    isAlex
                      ? "mr-0 border-border bg-surface sm:mr-8"
                      : "ml-4 border-border bg-brand-quiet/60 sm:ml-8"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full",
                          isAlex
                            ? "bg-primary text-primary-foreground"
                            : "bg-foreground text-background"
                        )}
                      >
                        <User className="size-3" />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {turn.speaker}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {isAlex ? "Analyst" : "Challenger"}
                      </span>
                    </div>

                    <span className="font-mono text-[10px] text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>

                  <p className="pl-8 text-xs leading-relaxed text-foreground/90 sm:text-sm">
                    {turn.text}
                  </p>
                </div>

                {/* Render interruption card if one was asked here */}
                {matchingInterruption && (
                  <div className="mx-2 space-y-2 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-xs animate-fadeIn motion-reduce:animate-none sm:mx-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-warning">
                        <MessageCircleQuestion className="size-3.5" />
                        <span>
                          Listener Q&amp;A · {formatTime(matchingInterruption.timestamp)}
                        </span>
                      </div>
                      {(matchingInterruption.audioUrl || workspaceId) && (
                        <button
                          type="button"
                          onClick={() => handlePlayInterruption(matchingInterruption)}
                          aria-label={`Replay listener question at ${formatTime(matchingInterruption.timestamp)}`}
                          className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-1 text-[11px] font-medium text-warning transition-colors hover:bg-warning/30 motion-reduce:transition-none"
                        >
                          <Play className="size-3 fill-current" />
                          <span>Replay Q&amp;A</span>
                        </button>
                      )}
                    </div>
                    <p className="pl-5 font-medium italic text-foreground">
                      &ldquo;{matchingInterruption.userQuestion}&rdquo;
                    </p>
                    <div className="space-y-1 border-t border-warning/20 pl-5 pt-2">
                      {matchingInterruption.dialogue.map((d, dIdx) => (
                        <p key={dIdx} className="text-[11px] text-foreground/80">
                          <strong>{d.speaker}:</strong> {d.text}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* "Ask the Hosts" Interruption Modal */}
      {isInterruptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(e) =>
            dismissOnBackdropClick(e, () => setIsInterruptModalOpen(false))
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="interrupt-dialog-title"
            aria-describedby="interrupt-dialog-subtitle"
            className="kairos-panel w-full max-w-lg animate-fadeIn space-y-4 p-5 text-foreground motion-reduce:animate-none sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                  <Radio className="size-4 animate-pulse motion-reduce:animate-none" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="interrupt-dialog-title"
                    className="kairos-section-title text-base"
                  >
                    Interrupt &amp; Ask the Hosts
                  </h3>
                  <span
                    id="interrupt-dialog-subtitle"
                    className="mt-1 block text-[11px] text-muted-foreground"
                  >
                    Paused at {formatTime(savedResumeTime)} · Alex &amp; Jordan will address you live
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInterruptModalOpen(false)}
                disabled={isSubmittingInterrupt}
                aria-label="Close interrupt dialog"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none disabled:opacity-40"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick suggested questions */}
            <div className="space-y-1.5">
              <span className="kairos-eyebrow block">
                Suggested questions from your notes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_INTERRUPTIONS.map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isSubmittingInterrupt}
                    onClick={() => {
                      setUserQuestion(sq);
                      handleSendInterruption(sq);
                    }}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1 text-left text-[11px] text-foreground transition-colors hover:border-brand/40 hover:bg-brand-quiet motion-reduce:transition-none disabled:opacity-40"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom question input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendInterruption();
              }}
              className="space-y-3 pt-2"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="interrupt-question"
                  className="block text-xs font-medium text-foreground"
                >
                  Or ask your own question:
                </label>
                <textarea
                  id="interrupt-question"
                  rows={3}
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  placeholder="e.g., Wait, does this work with multimodal embeddings?"
                  disabled={isSubmittingInterrupt}
                  className="kairos-inset w-full resize-none px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/40 disabled:opacity-50"
                  autoFocus
                />
              </div>

              {interruptError && (
                <p className="kairos-inset border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
                  {interruptError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmittingInterrupt}
                  onClick={() => setIsInterruptModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isSubmittingInterrupt || !userQuestion.trim()}
                  className="gap-1.5 bg-primary text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 motion-reduce:transition-none"
                >
                  {isSubmittingInterrupt ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                      <span>Alex &amp; Jordan researching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      <span>Ask Co-Hosts</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
