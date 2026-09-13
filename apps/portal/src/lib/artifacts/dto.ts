import type { LearningArtifactData } from "./types";

// Client-safety projection applied to everything handed to the browser.
// PODCAST metadata carries the media storage reference (storageKey +
// storageProvider) which the engine needs to serve audio through the media
// route; it must never leave this server boundary, so it is stripped in this
// single choke point and nowhere else. Interruption history rides on the same
// metadata field, so each entry's audio reference is stripped here too.
export function toWorkspaceArtifactData(artifact: LearningArtifactData): LearningArtifactData {
  const metadata = artifact.metadata as Record<string, unknown> | null;
  let safeMetadata = metadata;

  const audio = metadata?.audio;
  if (audio && typeof audio === "object") {
    const safeAudio = { ...(audio as Record<string, unknown>) };
    delete safeAudio.storageKey;
    delete safeAudio.storageProvider;
    safeMetadata = { ...metadata, audio: safeAudio };
  }

  const interruptions = safeMetadata?.interruptions;
  if (Array.isArray(interruptions)) {
    safeMetadata = {
      ...safeMetadata,
      interruptions: interruptions.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const record = entry as Record<string, unknown>;
        const recAudio = record.audio;
        if (!recAudio || typeof recAudio !== "object") return entry;
        const safeRecAudio = { ...(recAudio as Record<string, unknown>) };
        delete safeRecAudio.storageKey;
        delete safeRecAudio.storageProvider;
        return { ...record, audio: safeRecAudio };
      }),
    };
  }

  return {
    ...artifact,
    metadata: (safeMetadata ?? null) as LearningArtifactData["metadata"],
  };
}