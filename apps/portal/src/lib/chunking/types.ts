export type ChunkStrategy = "recursive" | "sentence" | "fixed" | "markdown" | "semantic";

export interface Chunk {
  content: string;
  index: number;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
  strategy: ChunkStrategy;
}

export interface ChunkStats {
  estimatedChunkCount: number;
  averageChunkSize: number;
  averageTokenCount: number;
  totalCharacters: number;
}

export const CHUNK_STRATEGIES: { value: ChunkStrategy; label: string; description: string }[] = [
  { value: "recursive", label: "Recursive", description: "Split on natural boundaries (paragraphs, sentences, words)" },
  { value: "sentence", label: "Sentence", description: "Split on sentence boundaries" },
  { value: "fixed", label: "Fixed Size", description: "Split into fixed-size chunks with overlap" },
  { value: "markdown", label: "Markdown-Aware", description: "Split preserving markdown structure (headings, lists)" },
  { value: "semantic", label: "Semantic-Ready", description: "Split with semantic boundary detection" },
];
