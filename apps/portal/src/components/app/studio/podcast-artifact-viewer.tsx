"use client";

import { AlertCircle, FileText, Loader2, Podcast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { resolveSourceProvenance } from "@/lib/artifacts/summary-view";
import { parsePodcastContent, parsePodcastAudioMetadata } from "@/lib/artifacts/podcast-view";
import { PODCAST_HOST_PERSONAS } from "@/lib/artifacts/podcast";
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

export function PodcastArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parsePodcastContent(artifact.content);
  const audio = parsePodcastAudioMetadata(artifact.metadata);
  const provenance = resolveSourceProvenance(artifact.sourceIds, sources);

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
            {artifact.status === "COMPLETED" && audio?.durationSeconds != null && (
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

        {artifact.status === "COMPLETED" &&
          (!content ? (
            <div className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
              <p>This podcast&apos;s content is unavailable to display.</p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{content.summary}</p>

              {audio ? (
                <div className="mt-4">
                  <audio
                    controls
                    preload="none"
                    className="w-full"
                    src={`/api/artifacts/${artifact.id}/audio`}
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
      </div>
    </section>
  );
}