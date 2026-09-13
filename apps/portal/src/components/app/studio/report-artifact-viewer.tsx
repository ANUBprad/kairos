"use client";

import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import {
  resolveSourceProvenance,
} from "@/lib/artifacts/summary-view";
import { parseReportContent } from "@/lib/artifacts/report-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

export function ReportArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parseReportContent(artifact.content);
  const provenance = resolveSourceProvenance(artifact.sourceIds, sources);

  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Report artifact">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-text-primary">
              {artifact.name || "Untitled report"}
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
            This report is still being generated.
          </div>
        )}

        {artifact.status === "FAILED" && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>This report failed to generate. You can try again from a new source selection.</p>
          </div>
        )}

        {artifact.status === "COMPLETED" &&
          (!content ? (
            <div className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
              <p>This report&apos;s content is unavailable to display.</p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>

              <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Executive summary
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {content.executiveSummary}
              </p>

              <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Sections
              </h4>
              <div className="mt-2 space-y-5">
                {content.sections.map((section, index) => (
                  <div key={index}>
                    <h5 className="text-sm font-semibold text-text-primary">{section.heading}</h5>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>

              <h4 className="mt-6 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Key findings
              </h4>
              <ul className="mt-2 space-y-1.5">
                {content.keyFindings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span>{finding}</span>
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