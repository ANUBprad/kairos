import type { Chunk, ChunkingOptions, ChunkStats } from "./types";

const DEFAULT_OPTIONS: ChunkingOptions = {
  chunkSize: 1000,
  overlap: 200,
  strategy: "recursive",
};

export function chunkText(
  text: string,
  options: Partial<ChunkingOptions> = {},
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  switch (opts.strategy) {
    case "sentence":
      return chunkBySentence(text, opts);
    case "fixed":
      return chunkFixed(text, opts);
    case "markdown":
      return chunkMarkdown(text, opts);
    case "semantic":
      return chunkSemantic(text, opts);
    default:
      return chunkRecursive(text, opts);
  }
}

export function estimateChunkStats(
  text: string,
  options: Partial<ChunkingOptions> = {},
): ChunkStats {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const totalChars = text.length;
  const effectiveSize = opts.chunkSize - opts.overlap;
  if (effectiveSize <= 0) {
    return { estimatedChunkCount: 1, averageChunkSize: totalChars, averageTokenCount: estimateTokens(text), totalCharacters: totalChars };
  }
  const estimatedCount = Math.max(1, Math.ceil(totalChars / effectiveSize));
  const avgSize = Math.min(opts.chunkSize, Math.ceil(totalChars / estimatedCount));
  return {
    estimatedChunkCount: estimatedCount,
    averageChunkSize: avgSize,
    averageTokenCount: estimateTokens(String(avgSize)),
    totalCharacters: totalChars,
  };
}

function chunkRecursive(text: string, opts: ChunkingOptions): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, overlap } = opts;
  const separators = ["\n\n", "\n", ". ", " ", ""];

  function split(text: string, sepIndex: number): string[] {
    if (sepIndex >= separators.length) return [text];
    const sep = separators[sepIndex];
    const parts: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;
      if (end >= text.length) {
        parts.push(text.slice(start));
        break;
      }
      const searchStart = Math.max(start, end - Math.floor(chunkSize * 0.3));
      const searchEnd = end + Math.floor(chunkSize * 0.1);
      const slice = text.slice(searchStart, Math.min(searchEnd, text.length));
      const sepIdx = sep ? slice.lastIndexOf(sep) : -1;
      if (sepIdx !== -1) {
        end = searchStart + sepIdx + sep.length;
      }
      parts.push(text.slice(start, Math.min(end, text.length)));
      start = end - overlap;
      if (start < 0) start = 0;
    }
    return parts;
  }

  const parts = split(text, 0);
  for (let i = 0; i < parts.length; i++) {
    const content = parts[i].trim();
    if (content) {
      chunks.push({
        content,
        index: i,
        tokenCount: estimateTokens(content),
        metadata: {
          strategy: "recursive",
          chunkSize,
          overlap,
        },
      });
    }
  }
  return chunks;
}

function chunkBySentence(text: string, opts: ChunkingOptions): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, overlap } = opts;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let current = "";
  let index = 0;

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push({
        content: current.trim(),
        index: index++,
        tokenCount: estimateTokens(current),
        metadata: { strategy: "sentence", chunkSize, overlap },
      });
      const words = current.split(" ");
      const overlapWords = words.slice(
        Math.max(0, words.length - Math.floor(overlap / 5)),
      );
      current = overlapWords.join(" ") + " ";
    }
    current += sentence;
  }

  const trimmed = current.trim();
  if (trimmed) {
    chunks.push({
      content: trimmed,
      index,
      tokenCount: estimateTokens(trimmed),
      metadata: { strategy: "sentence", chunkSize, overlap },
    });
  }

  return chunks;
}

function chunkFixed(text: string, opts: ChunkingOptions): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, overlap } = opts;
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end).trim();
    if (content) {
      chunks.push({
        content,
        index: index++,
        tokenCount: estimateTokens(content),
        metadata: { strategy: "fixed", chunkSize, overlap },
      });
    }
    start += chunkSize - overlap;
  }

  return chunks;
}

function chunkMarkdown(text: string, opts: ChunkingOptions): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, overlap } = opts;

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections: { heading: string; content: string; level: number }[] = [];
  let lastIndex = 0;
  let lastHeading = "";
  let lastLevel = 0;

  let match;
  while ((match = headingRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      sections.push({
        heading: lastHeading,
        content: text.slice(lastIndex, match.index).trim(),
        level: lastLevel,
      });
    }
    lastHeading = match[2];
    lastLevel = match[1].length;
    lastIndex = match.index;
  }

  if (lastIndex < text.length) {
    sections.push({
      heading: lastHeading,
      content: text.slice(lastIndex).trim(),
      level: lastLevel,
    });
  }

  if (sections.length === 0) {
    return chunkRecursive(text, opts);
  }

  let currentContent = "";
  let index = 0;

  for (const section of sections) {
    const headingTag = section.heading ? `${"#".repeat(section.level)} ${section.heading}\n\n` : "";
    const sectionText = headingTag + section.content;

    if ((currentContent + "\n\n" + sectionText).length > chunkSize && currentContent.length > 0) {
      chunks.push({
        content: currentContent.trim(),
        index: index++,
        tokenCount: estimateTokens(currentContent),
        metadata: { strategy: "markdown", chunkSize, overlap, heading: section.heading || null },
      });
      const lines = currentContent.split("\n");
      const overlapLines = lines.slice(Math.max(0, lines.length - Math.ceil(overlap / 40)));
      currentContent = overlapLines.join("\n") + "\n";
    }
    currentContent = currentContent ? currentContent + "\n\n" + sectionText : sectionText;
  }

  const trimmed = currentContent.trim();
  if (trimmed) {
    chunks.push({
      content: trimmed,
      index,
      tokenCount: estimateTokens(trimmed),
      metadata: { strategy: "markdown", chunkSize, overlap },
    });
  }

  return chunks;
}

function chunkSemantic(text: string, opts: ChunkingOptions): Chunk[] {
  const { chunkSize, overlap } = opts;
  const paragraphSep = "\n\n";
  const paragraphs = text.split(paragraphSep).filter((p) => p.trim().length > 0);

  if (paragraphs.length <= 1) {
    return chunkRecursive(text, opts);
  }

  const chunks: Chunk[] = [];
  let currentGroup: string[] = [];
  let currentSize = 0;
  let index = 0;

  for (const para of paragraphs) {
    const paraLen = para.length;
    if (currentSize + paraLen > chunkSize && currentGroup.length > 0) {
      const content = currentGroup.join(paragraphSep).trim();
      if (content) {
        chunks.push({
          content,
          index: index++,
          tokenCount: estimateTokens(content),
          metadata: { strategy: "semantic", chunkSize, overlap, paragraphCount: currentGroup.length },
        });
      }
      const overlapParas = currentGroup.slice(Math.max(0, currentGroup.length - Math.max(1, Math.floor(overlap / 200))));
      currentGroup = overlapParas.length > 0 ? [...overlapParas] : [];
      currentSize = currentGroup.join(paragraphSep).length;
    }
    currentGroup.push(para);
    currentSize += paraLen;
  }

  if (currentGroup.length > 0) {
    const content = currentGroup.join(paragraphSep).trim();
    if (content) {
      chunks.push({
        content,
        index,
        tokenCount: estimateTokens(content),
        metadata: { strategy: "semantic", chunkSize, overlap, paragraphCount: currentGroup.length },
      });
    }
  }

  return chunks;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type { Chunk, ChunkingOptions, ChunkStats, ChunkStrategy } from "./types";
export { CHUNK_STRATEGIES } from "./types";
