import { ClipboardList, FileText, Lightbulb, ListChecks, SquareStack, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ArtifactType } from "@prisma/client";

export interface ArtifactTypeMeta {
  label: string;
  description: string;
  Icon: LucideIcon;
}

// The studio generation panel supports exactly these six artifact types.
// PODCAST is intentionally absent: it belongs to the deferred audio phase and
// the UI never advertises what it cannot generate.
export const ACTIVE_STUDIO_ARTIFACT_TYPES = [
  "SUMMARY",
  "REPORT",
  "QUIZ",
  "FLASHCARDS",
  "MINDMAP",
  "TAKEAWAYS",
] as const;

export type ActiveStudioArtifactType = (typeof ACTIVE_STUDIO_ARTIFACT_TYPES)[number];

export const ARTIFACT_TYPE_META: Readonly<Record<ActiveStudioArtifactType, ArtifactTypeMeta>> = {
  SUMMARY: {
    label: "Summary",
    description: "A concise overview of the selected sources.",
    Icon: FileText,
  },
  REPORT: {
    label: "Report",
    description: "A structured report with sections and key findings.",
    Icon: ClipboardList,
  },
  QUIZ: {
    label: "Quiz",
    description: "Multiple-choice study questions with explanations.",
    Icon: ListChecks,
  },
  FLASHCARDS: {
    label: "Flashcards",
    description: "A study deck of front-and-back cards.",
    Icon: SquareStack,
  },
  MINDMAP: {
    label: "Mind Map",
    description: "A rooted hierarchy of connected concepts.",
    Icon: Workflow,
  },
  TAKEAWAYS: {
    label: "Takeaways",
    description: "The key points worth remembering from the sources.",
    Icon: Lightbulb,
  },
};

export function isActiveStudioArtifactType(type: ArtifactType): type is ActiveStudioArtifactType {
  return (ACTIVE_STUDIO_ARTIFACT_TYPES as readonly ArtifactType[]).includes(type);
}