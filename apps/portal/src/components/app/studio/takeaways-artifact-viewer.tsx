"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactSourceList } from "./artifact-source-list";
import { parseTakeawaysContent } from "@/lib/artifacts/takeaways-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

export function TakeawaysArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parseTakeawaysContent(artifact.content);

  return (
    <article className="mx-auto max-w-[72ch]" aria-label="Takeaways artifact">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <ArtifactStatusBadge status={artifact.status} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <h2 className="page-title mt-3">{artifact.name || "Untitled takeaways"}</h2>
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
          These takeaways are still being generated.
        </div>
      )}

      {artifact.status === "FAILED" && (
        <div className="flex items-start gap-2 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>These takeaways failed to generate. You can try again from a new source selection.</p>
        </div>
      )}

      {artifact.status === "COMPLETED" &&
        (!content ? (
          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
            <p>These takeaways&apos; content is unavailable to display.</p>
          </div>
        ) : (
          <div className="prose-reading">
            {content.takeaways.map((takeaway, index) => (
              <div key={index}>
                <h3>{takeaway.heading}</h3>
                <p>{takeaway.detail}</p>
              </div>
            ))}

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