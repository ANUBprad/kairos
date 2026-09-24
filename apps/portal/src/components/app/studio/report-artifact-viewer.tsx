"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactSourceList } from "./artifact-source-list";
import { parseReportContent } from "@/lib/artifacts/report-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

export function ReportArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parseReportContent(artifact.content);

  return (
    <article className="mx-auto max-w-[72ch]" aria-label="Report artifact">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <ArtifactStatusBadge status={artifact.status} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <h2 className="page-title mt-3">{content?.title || artifact.name || "Untitled report"}</h2>
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
          <div className="prose-reading">
            <p>{content.executiveSummary}</p>

            {content.sections.map((section, index) => (
              <div key={index}>
                <h3>{section.heading}</h3>
                <p>{section.content}</p>
              </div>
            ))}

            {content.keyFindings.length > 0 && (
              <>
                <h3>Key findings</h3>
                <ul>
                  {content.keyFindings.map((finding, index) => (
                    <li key={index}>{finding}</li>
                  ))}
                </ul>
              </>
            )}

            <h4>Sources</h4>
            <ArtifactSourceList artifact={artifact} sources={sources} />
          </div>
        ))}
    </article>
  );
}