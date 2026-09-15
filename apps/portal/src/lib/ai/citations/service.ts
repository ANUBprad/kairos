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

const CITATION_MARKER = /\[Source\s+([^\]]+)\]/g;

// Keeps only the citations the answer explicitly references via [Source N]
// markers. Markers accept single numbers, comma/space lists and ranges
// ("[Source 1]", "[Source 1, 3]", "[Source 2-4]"). Out-of-range references
// are ignored. When the answer cites nothing (model non-compliance) every
// retrieved chunk is kept so the evidence behind the answer stays visible.
export function filterCitationsToContent(
  citations: CitationSource[],
  content: string,
): CitationSource[] {
  if (citations.length === 0 || !content) return citations;

  const refs: number[] = [];
  const marker = CITATION_MARKER;
  marker.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = marker.exec(content)) !== null) {
    const refText = match[1];
    for (const token of refText.split(/\s*,\s*|\s+/)) {
      if (!token) continue;
      const range = /^(\d+)\s*[-\u2013]\s*(\d+)$/.exec(token);
      if (range) {
        const start = parseInt(range[1], 10);
        const end = parseInt(range[2], 10);
        for (let n = start; n <= end; n++) refs.push(n);
      } else {
        const n = parseInt(token, 10);
        if (Number.isInteger(n)) refs.push(n);
      }
    }
  }

  const inRange = refs.filter((n) => n >= 1 && n <= citations.length);
  if (inRange.length === 0) return citations;

  return [...new Set(inRange)]
    .sort((a, b) => a - b)
    .map((n) => citations[n - 1]);
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
