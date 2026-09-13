"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ARTIFACT_TYPE_META, isActiveStudioArtifactType } from "./artifact-type-meta";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifacts: LearningArtifactData[];
  onOpen: (artifactId: string) => void;
}

export function ArtifactList({ artifacts, onOpen }: Props) {
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
            </div>
            <ArtifactStatusBadge status={artifact.status} className="hidden sm:inline-flex" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpen(artifact.id)}
              aria-label={`Open ${artifact.name || "artifact"}`}
            >
              View
            </Button>
          </li>
        );
      })}
    </ul>
  );
}