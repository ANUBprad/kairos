export interface Chunk {
  content: string;
  index: number;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
  strategy: "recursive" | "sentence";
}
