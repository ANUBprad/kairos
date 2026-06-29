import type { Chunk, ChunkingOptions } from "./types";

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
  return opts.strategy === "sentence"
    ? chunkBySentence(text, opts)
    : chunkRecursive(text, opts);
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
          charStart: parts[i].length > 0 ? text.indexOf(content) : undefined,
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
        metadata: {
          strategy: "sentence",
          chunkSize,
          overlap,
        },
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
      metadata: {
        strategy: "sentence",
        chunkSize,
        overlap,
      },
    });
  }

  return chunks;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type { Chunk, ChunkingOptions } from "./types";
