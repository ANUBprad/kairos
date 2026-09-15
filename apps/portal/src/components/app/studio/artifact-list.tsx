"use client";

import { FileText, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ARTIFACT_TYPE_META, isActiveStudioArtifactType } from "./artifact-type-meta";
import type { LearningArtifactWithStudy } from "@/lib/artifacts/types";

interface Props {
  artifacts: LearningArtifactWithStudy[];
  onOpen: (artifactId: string) => void;
  onRegenerate?: (artifact: LearningArtifactWithStudy) => void;
  onDelete?: (artifact: LearningArtifactWithStudy) => void;
  regeneratingId?: string | null;
}

const isTerminal = (status: LearningArtifactWithStudy["status"]) =>
  status === "COMPLETED" || status === "FAILED";

export function ArtifactList({ artifacts, onOpen, onRegenerate, onDelete, regeneratingId }: Props) {
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
        <FileText size={24} className="text-text-tertiary" />
        <p className="mt-3 text-sm font-medium text-text-primary">No artifacts yet</p>
        <p className="mt-1 text-xs text-text-tertiary">Generate an artifact above to see it here.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {artifacts.map((artifact) => {
        const meta = isActiveStudioArtifactType(artifact.type)
          ? ARTIFACT_TYPE_META[artifact.type]
          : null;
        const terminal = isTerminal(artifact.status);
        const busy = regeneratingId === artifact.id;
        return (
          <li key={artifact.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {meta ? <meta.Icon size={14} className="shrink-0 text-text-tertiary" /> : null}
                <p className="truncate text-sm font-medium text-text-primary">
                  {artifact.name || `Untitled ${meta?.label.toLowerCase() ?? "artifact"}`}
                </p>
                {meta ? (
                  <Badge variant="secondary" className="shrink-0">
                    {meta.label}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {new Date(artifact.createdAt).toLocaleDateString()}
                {artifact.sourceIds.length > 0 &&
                  ` · ${artifact.sourceIds.length} source${artifact.sourceIds.length !== 1 ? "s" : ""}`}
              </p>
              {artifact.study && artifact.type === "QUIZ" && (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {artifact.study.attempts > 0
                    ? `Took it ${artifact.study.attempts}× · best ${artifact.study.bestScore ?? 0}/${artifact.study.totalQuestions ?? 0}`
                    : "Not taken yet"}
                </p>
              )}
              {artifact.study && artifact.type === "FLASHCARDS" && (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {artifact.study.attempts > 0
                    ? `${artifact.study.knownCount ?? 0} of ${artifact.study.attempts} reviewed card${artifact.study.attempts !== 1 ? "s" : ""} known`
                    : "Not reviewed yet"}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ArtifactStatusBadge status={artifact.status} className="hidden sm:inline-flex" />
              {artifact.status === "COMPLETED" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpen(artifact.id)}
                  aria-label={`Open ${artifact.name || "artifact"}`}
                >
                  View
                </Button>
              )}
              {terminal && onRegenerate && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onRegenerate(artifact)}
                  aria-label={`Regenerate ${artifact.name || "artifact"}`}
                >
                  <RefreshCw size={13} />
                  {busy ? "Regenerating…" : "Regenerate"}
                </Button>
              )}
              {terminal && onDelete && (
                <Button
                  variant="danger-outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onDelete(artifact)}
                  aria-label={`Delete ${artifact.name || "artifact"}`}
                >
                  <Trash2 size={13} />
                  Delete
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}