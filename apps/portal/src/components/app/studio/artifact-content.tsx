"use client";

import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { SummaryArtifactViewer } from "./summary-artifact-viewer";
import { ReportArtifactViewer } from "./report-artifact-viewer";
import { QuizArtifactViewer } from "./quiz-artifact-viewer";
import { FlashcardsArtifactViewer } from "./flashcards-artifact-viewer";
import { MindmapArtifactViewer } from "./mindmap-artifact-viewer";
import { TakeawaysArtifactViewer } from "./takeaways-artifact-viewer";
import { PodcastArtifactViewer } from "./podcast-artifact-viewer";
import { isActiveStudioArtifactType, type ActiveStudioArtifactType } from "./artifact-type-meta";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface ArtifactContentProps {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

// One shared routing decision for which viewer renders an artifact type.
// Both the Studio dialog and the artifact detail page render through this
// component so the seven viewers are never duplicated.
export const ARTIFACT_TYPE_VIEWERS: Readonly<
  Record<ActiveStudioArtifactType, ComponentType<ArtifactContentProps>>
> = {
  SUMMARY: SummaryArtifactViewer,
  REPORT: ReportArtifactViewer,
  QUIZ: QuizArtifactViewer,
  FLASHCARDS: FlashcardsArtifactViewer,
  MINDMAP: MindmapArtifactViewer,
  TAKEAWAYS: TakeawaysArtifactViewer,
  PODCAST: PodcastArtifactViewer,
};

export function ArtifactContent({ artifact, sources, onClose }: ArtifactContentProps) {
  if (artifact.status === "COMPLETED") {
    if (isActiveStudioArtifactType(artifact.type)) {
      const Viewer = ARTIFACT_TYPE_VIEWERS[artifact.type];
      return <Viewer artifact={artifact} sources={sources} onClose={onClose} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <ArtifactStatusBadge status={artifact.status} />
        <p className="text-sm text-text-secondary">This artifact type is not viewable yet.</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <ArtifactStatusBadge status={artifact.status} />
      <p className="max-w-sm text-center text-sm text-text-secondary">
        {artifact.status === "FAILED"
          ? "Generation failed. Regenerate this artifact to retry, or delete it."
          : "This artifact is still being generated. Check back shortly."}
      </p>
      <Button variant="secondary" size="sm" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
