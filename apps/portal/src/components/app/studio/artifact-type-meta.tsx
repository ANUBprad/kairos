import { ClipboardList, FileText, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ArtifactType } from "@prisma/client";

export interface ArtifactTypeMeta {
  label: string;
  description: string;
  Icon: LucideIcon;
}

// The studio generation panel supports exactly these three artifact types.
// The backend registry may gain more later; the UI only advertises what it
// can actually generate.
export const ACTIVE_STUDIO_ARTIFACT_TYPES = ["SUMMARY", "REPORT", "QUIZ"] as const;

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
};

export function isActiveStudioArtifactType(type: ArtifactType): type is ActiveStudioArtifactType {
  return (ACTIVE_STUDIO_ARTIFACT_TYPES as readonly ArtifactType[]).includes(type);
}