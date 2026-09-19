// The Trace model carries no chat identifiers, so the active scope rides in
// its metadata JSON. Kept pure so tests can pin the exact shape.
export function buildChatTraceMetadata(input: {
  knowledgeBaseId: string;
  conversationId: string;
  sourceIds: string[];
}): Record<string, unknown> {
  return {
    knowledgeBaseId: input.knowledgeBaseId,
    conversationId: input.conversationId,
    sourceIds: [...input.sourceIds],
  };
}