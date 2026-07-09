import type { Citation, RetrievalChunk } from "./types";

export interface CitationMatch {
  citation: Citation;
  chunk: RetrievalChunk;
  matchType: "exact" | "partial" | "semantic";
  confidence: number;
}

export function findCitationsInAnswer(
  answerText: string,
  chunks: RetrievalChunk[],
): CitationMatch[] {
  const matches: CitationMatch[] = [];

  for (const chunk of chunks) {
    const answerLower = answerText.toLowerCase();

    const chunkSentences = chunk.content.split(/[.!?]+/).filter((s) => s.trim().length > 20);

    for (const sentence of chunkSentences) {
      const sentenceLower = sentence.trim().toLowerCase();
      if (sentenceLower.length < 20) continue;

      if (answerLower.includes(sentenceLower)) {
        const startOffset = answerText.toLowerCase().indexOf(sentenceLower);
        matches.push({
          citation: {
            chunkId: chunk.chunkId,
            content: chunk.content,
            documentName: chunk.documentName,
            similarity: chunk.similarity,
            startOffset,
            endOffset: startOffset + sentence.length,
            claimText: sentence.trim(),
          },
          chunk,
          matchType: "exact",
          confidence: 1.0,
        });
      } else {
        const words = sentenceLower.split(/\s+/).filter((w) => w.length > 4);
        const matchingWords = words.filter((w) => answerLower.includes(w));
        if (matchingWords.length >= 3 && matchingWords.length / words.length > 0.5) {
          matches.push({
            citation: {
              chunkId: chunk.chunkId,
              content: chunk.content,
              documentName: chunk.documentName,
              similarity: chunk.similarity,
              startOffset: -1,
              endOffset: -1,
              claimText: sentence.trim(),
            },
            chunk,
            matchType: "partial",
            confidence: matchingWords.length / words.length,
          });
        }
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

export function getCitationCoverage(
  matches: CitationMatch[],
  totalChunks: number,
): {
  citedChunks: number;
  uncitedChunks: number;
  coverageRatio: number;
  totalMatches: number;
  exactMatches: number;
  partialMatches: number;
} {
  const citedChunkIds = new Set(matches.map((m) => m.chunk.chunkId));
  const citedChunks = citedChunkIds.size;
  const uncitedChunks = totalChunks - citedChunks;
  const coverageRatio = totalChunks > 0 ? citedChunks / totalChunks : 0;

  return {
    citedChunks,
    uncitedChunks,
    coverageRatio,
    totalMatches: matches.length,
    exactMatches: matches.filter((m) => m.matchType === "exact").length,
    partialMatches: matches.filter((m) => m.matchType === "partial").length,
  };
}

export function formatCitationOverlay(
  answerText: string,
  matches: CitationMatch[],
): string {
  const parts: string[] = [];
  let lastIndex = 0;

  const sortedMatches = matches
    .filter((m) => m.citation.startOffset >= 0)
    .sort((a, b) => a.citation.startOffset - b.citation.startOffset);

  for (const match of sortedMatches) {
    if (match.citation.startOffset > lastIndex) {
      parts.push(answerText.slice(lastIndex, match.citation.startOffset));
    }
    parts.push(`[${match.chunk.documentName}]`);
    lastIndex = match.citation.endOffset;
  }

  if (lastIndex < answerText.length) {
    parts.push(answerText.slice(lastIndex));
  }

  return parts.join("");
}

export function getUnclaimedChunks(
  chunks: RetrievalChunk[],
  matches: CitationMatch[],
): RetrievalChunk[] {
  const citedIds = new Set(matches.map((m) => m.chunk.chunkId));
  return chunks.filter((c) => !citedIds.has(c.chunkId));
}
