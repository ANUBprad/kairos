import { ClipboardList, FileText, Lightbulb, ListChecks, Podcast, SquareStack, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ArtifactType } from "@prisma/client";

export interface ArtifactTypeMeta {
  label: string;
  description: string;
  Icon: LucideIcon;
}

// The studio generation panel supports exactly these seven artifact types.
// A type the UI advertises is a type the engine can generate; nothing else
// appears as an option.
export const ACTIVE_STUDIO_ARTIFACT_TYPES = [
  "SUMMARY",
  "REPORT",
  "QUIZ",
  "FLASHCARDS",
  "MINDMAP",
  "TAKEAWAYS",
  "PODCAST",
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
  PODCAST: {
    label: "Podcast",
    description: "A two-host audio episode grounded in the sources.",
    Icon: Podcast,
  },
};

export function isActiveStudioArtifactType(type: ArtifactType): type is ActiveStudioArtifactType {
  return (ACTIVE_STUDIO_ARTIFACT_TYPES as readonly ArtifactType[]).includes(type);
}