import type { LearningArtifactData } from "./types";

// Client-safety projection applied to everything handed to the browser.
// PODCAST metadata carries the media storage reference (storageKey +
// storageProvider) which the engine needs to serve audio through the media
// route; it must never leave this server boundary, so it is stripped in this
// single choke point and nowhere else.
export function toWorkspaceArtifactData(artifact: LearningArtifactData): LearningArtifactData {
  const metadata = artifact.metadata as Record<string, unknown> | null;
  const audio = metadata?.audio;
  if (!audio || typeof audio !== "object") return artifact;
  const safeAudio = { ...(audio as Record<string, unknown>) };
  delete safeAudio.storageKey;
  delete safeAudio.storageProvider;
  return {
    ...artifact,
    metadata: { ...metadata, audio: safeAudio } as LearningArtifactData["metadata"],
  };
}