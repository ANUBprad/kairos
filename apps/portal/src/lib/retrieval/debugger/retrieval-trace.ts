import type { RetrievalTrace, RetrievalStep, RetrievalChunk, PromptConstruction } from "./types";

export interface TraceBuilderOptions {
  query: string;
  strategy: string;
  config: Record<string, unknown>;
}

export class RetrievalTraceBuilder {
  private trace: Partial<RetrievalTrace>;
  private steps: RetrievalStep[] = [];
  private startTime: number;

  constructor(options: TraceBuilderOptions) {
    this.startTime = performance.now();
    this.trace = {
      query: options.query,
      strategy: options.strategy,
      config: options.config,
      timestamp: Date.now(),
    };
  }

  setEmbedding(embedding: number[], latencyMs: number): void {
    this.trace.embedding = embedding;
    this.trace.embeddingLatencyMs = latencyMs;
  }

  addStep(step: string, description: string, input: unknown, output: unknown, latencyMs: number): void {
    this.steps.push({
      step,
      description,
      latencyMs,
      timestamp: performance.now() - this.startTime,
      input,
      output,
    });
  }

  setRetrievedChunks(chunks: RetrievalChunk[]): void {
    this.trace.retrievedChunks = chunks;
  }

  setRerankedChunks(chunks: RetrievalChunk[]): void {
    this.trace.rerankedChunks = chunks;
  }

  setPrompt(prompt: PromptConstruction): void {
    this.trace.prompt = prompt;
  }

  build(): RetrievalTrace {
    return {
      query: this.trace.query ?? "",
      strategy: this.trace.strategy ?? "",
      config: this.trace.config ?? {},
      embedding: this.trace.embedding ?? [],
      embeddingLatencyMs: this.trace.embeddingLatencyMs ?? 0,
      steps: this.steps,
      retrievedChunks: this.trace.retrievedChunks ?? [],
      rerankedChunks: this.trace.rerankedChunks ?? [],
      prompt: this.trace.prompt ?? {
        systemPrompt: "",
        userMessage: "",
        contextChunks: [],
        totalTokens: 0,
      },
      totalLatencyMs: performance.now() - this.startTime,
      timestamp: this.trace.timestamp ?? Date.now(),
    };
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

export function rankChunksBySimilarity(chunks: RetrievalChunk[]): RetrievalChunk[] {
  return [...chunks].sort((a, b) => b.similarity - a.similarity).map((c, i) => ({ ...c, rank: i + 1 }));
}

export function filterChunksAboveThreshold(chunks: RetrievalChunk[], threshold: number): RetrievalChunk[] {
  return chunks.filter((c) => c.similarity >= threshold);
}

export function getChunkOverlap(a: RetrievalChunk[], b: RetrievalChunk[]): string[] {
  const idsA = new Set(a.map((c) => c.chunkId));
  return b.filter((c) => idsA.has(c.chunkId)).map((c) => c.chunkId);
}

export function getChunksOnlyInA(a: RetrievalChunk[], b: RetrievalChunk[]): string[] {
  const idsB = new Set(b.map((c) => c.chunkId));
  return a.filter((c) => !idsB.has(c.chunkId)).map((c) => c.chunkId);
}
