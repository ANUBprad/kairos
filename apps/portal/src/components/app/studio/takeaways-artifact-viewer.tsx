"use client";

import { AlertCircle, FileText, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { resolveSourceProvenance } from "@/lib/artifacts/summary-view";
import { parseTakeawaysContent } from "@/lib/artifacts/takeaways-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

export function TakeawaysArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parseTakeawaysContent(artifact.content);
  const provenance = resolveSourceProvenance(artifact.sourceIds, sources);

  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Takeaways artifact">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-text-primary">
              {artifact.name || "Untitled takeaways"}
            </h2>
            <ArtifactStatusBadge status={artifact.status} />
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            {new Date(artifact.createdAt).toLocaleString()}
            {artifact.sourceIds.length > 0 &&
              ` · ${artifact.sourceIds.length} source${artifact.sourceIds.length !== 1 ? "s" : ""}`}
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
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>

              <ul className="mt-4 space-y-3">
                {content.takeaways.map((takeaway, index) => (
                  <li key={index} className="rounded-lg border border-border p-4">
                    <div className="flex items-start gap-2">
                      <Lightbulb size={14} className="mt-0.5 shrink-0 text-brand" />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{takeaway.heading}</p>
                        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                          {takeaway.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

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