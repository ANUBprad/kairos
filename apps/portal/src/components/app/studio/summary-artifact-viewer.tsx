"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactSourceList } from "./artifact-source-list";
import { parseSummaryContent } from "@/lib/artifacts/summary-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

export function SummaryArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parseSummaryContent(artifact.content);

  return (
    <article className="mx-auto max-w-[72ch]" aria-label="Summary artifact">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <ArtifactStatusBadge status={artifact.status} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <h2 className="page-title mt-3">{artifact.name || "Untitled summary"}</h2>
        <p className="page-description mt-1">
          {new Date(artifact.createdAt).toLocaleDateString()}
          {artifact.sourceIds.length > 0 &&
            ` · ${artifact.sourceIds.length} source${artifact.sourceIds.length !== 1 ? "s" : ""}`}
        </p>
      </header>

      {artifact.status === "PENDING" && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
          Waiting to be processed.
        </div>
      )}

      {artifact.status === "PROCESSING" && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
          This summary is still being generated.
        </div>
      )}

      {artifact.status === "FAILED" && (
        <div className="flex items-start gap-2 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>This summary failed to generate. You can try again from a new source selection.</p>
        </div>
      )}

      {artifact.status === "COMPLETED" &&
        (!content ? (
          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
            <p>This summary&apos;s content is unavailable to display.</p>
          </div>
        ) : (
          <div className="prose-reading">
            <p>{content.overview}</p>

            <h3>Key points</h3>
            <ul>
              {content.keyPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>

            <h4>Sources</h4>
            <ArtifactSourceList artifact={artifact} sources={sources} />
          </div>
        ))}

      {!["PENDING", "PROCESSING", "FAILED", "COMPLETED"].includes(artifact.status) && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <AlertCircle size={16} className="shrink-0 text-text-tertiary" />
          <p>Unknown artifact status.</p>
        </div>
      )}
    </article>
  );
}