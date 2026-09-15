"use client";

import { AlertCircle, Loader2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactSourceList } from "./artifact-source-list";
import { parseMindmapContent } from "@/lib/artifacts/mindmap-view";
import type { MindMapNodeData } from "@/lib/artifacts/mindmap";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

// Dependency-free nested tree renderer. The persisted artifact is portable
// JSON; nothing here mutates it and no graph engine is involved.
function MindMapNodeTree({ node }: { node: MindMapNodeData }) {
  return (
    <li className="min-w-0">
      <div className="rounded-lg border border-border bg-surface px-3 py-2">
        <p className="text-sm font-medium text-text-primary">{node.label}</p>
        {node.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{node.description}</p>
        ) : null}
      </div>
      {node.children && node.children.length > 0 && (
        <ul className="mt-1.5 ml-6 space-y-1.5 border-l border-border pl-4">
          {node.children.map((child, index) => (
            <MindMapNodeTree key={index} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function MindmapArtifactViewer({ artifact, sources, onClose }: Props) {
  const content = parseMindmapContent(artifact.content);

  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Mind map artifact">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-text-primary">
              {artifact.name || "Untitled mind map"}
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
            This mind map is still being generated.
          </div>
        )}

        {artifact.status === "FAILED" && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>This mind map failed to generate. You can try again from a new source selection.</p>
          </div>
        )}

        {artifact.status === "COMPLETED" &&
          (!content ? (
            <div className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
              <p>This mind map&apos;s content is unavailable to display.</p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>

              <div className="mt-4 flex items-center gap-2">
                <Workflow size={14} className="shrink-0 text-text-tertiary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Concept map
                </span>
              </div>
              <ul className="mt-3">
                <MindMapNodeTree node={content.root} />
              </ul>

              {artifact.sourceIds.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                    Sources
                  </h4>
                  <ArtifactSourceList artifact={artifact} sources={sources} />
                </div>
              )}
            </div>
          ))}
      </div>
    </section>
  );
}