import type { CitationSource, RetrievedChunk } from "@/lib/ai/types";

export function extractCitationsFromChunks(chunks: RetrievedChunk[]): CitationSource[] {
  return chunks.map((c) => ({
    chunkId: c.id,
    documentId: c.documentId,
    documentName: c.documentName,
    chunkIndex: c.index,
    pageNumber: c.pageNumber ?? null,
    excerpt: c.content,
    similarity: c.similarity,
  }));
}

export function formatCitationsAsMarkdown(citations: CitationSource[]): string {
  if (citations.length === 0) return "";

  const lines = ["\n\n---\n**Sources**\n"];
  for (const c of citations) {
    const pageStr = c.pageNumber ? ` (Page ${c.pageNumber})` : "";
    const simStr = ` — ${Math.round(c.similarity * 100)}% match`;
    lines.push(
      `- **${c.documentName}**${pageStr}, Chunk #${c.chunkIndex}${simStr}`,
    );
  }
  return lines.join("\n");
}

export function buildCitationMap(citations: CitationSource[]): Map<string, CitationSource> {
  const map = new Map<string, CitationSource>();
  for (const c of citations) {
    map.set(c.chunkId, c);
  }
  return map;
}
