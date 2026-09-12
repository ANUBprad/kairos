import { prisma } from "@/lib/prisma";

export interface ArtifactSourceChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  index: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number | null;
}

export interface BoundedContext {
  context: string;
  includedChunks: number;
  totalChunks: number;
  truncatedChunks: number;
}

// Loads every indexed chunk of the given sources, in document-then-chunk
// order, so a summary generator sees the full selected scope (not the
// query-similar subset retrieval would return).
export async function loadArtifactSourceChunks(
  kbId: string,
  sourceIds: string[],
): Promise<ArtifactSourceChunk[]> {
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: { knowledgeBaseId: kbId, id: { in: sourceIds }, status: "INDEXED" },
    },
    select: {
      id: true,
      documentId: true,
      index: true,
      content: true,
      tokenCount: true,
      metadata: true,
      document: { select: { name: true } },
    },
    orderBy: [{ documentId: "asc" }, { index: "asc" }],
  });

  return chunks.map((c) => ({
    chunkId: c.id,
    documentId: c.documentId,
    documentName: c.document.name ?? c.documentId,
    index: c.index,
    pageNumber: (c.metadata as Record<string, unknown> | null)?.pageNumber as number | null ?? null,
    content: c.content,
    tokenCount: c.tokenCount,
  }));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Formats chunks as delimited <source> blocks and hard-caps context at
// maxTokens using whole chunks only (never splitting mid-chunk). The first
// chunk is always kept so callers get usable content even over budget.
export function buildBoundedContext(
  chunks: ArtifactSourceChunk[],
  maxTokens: number,
): BoundedContext {
  const blocks: string[] = [];
  let usedTokens = 0;

  for (const chunk of chunks) {
    const tokens = chunk.tokenCount ?? estimateTokens(chunk.content);
    if (usedTokens > 0 && usedTokens + tokens > maxTokens) break;
    blocks.push(
      `<source id="${chunk.chunkId}" document="${chunk.documentName}" chunk="${chunk.index}">\n${chunk.content}\n</source>`,
    );
    usedTokens += tokens;
  }

  return {
    context: blocks.join("\n\n"),
    includedChunks: blocks.length,
    totalChunks: chunks.length,
    truncatedChunks: chunks.length - blocks.length,
  };
}