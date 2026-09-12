// The Trace model carries no artifact identifiers, so the active scope rides
// in its metadata JSON. Kept pure so tests can pin the exact shape.
export function buildArtifactTraceMetadata(input: {
  artifactId: string;
  knowledgeBaseId: string;
  sourceIds: string[];
  artifactType: string;
}): Record<string, unknown> {
  return {
    artifactId: input.artifactId,
    knowledgeBaseId: input.knowledgeBaseId,
    sourceIds: [...input.sourceIds],
    artifactType: input.artifactType,
  };
}