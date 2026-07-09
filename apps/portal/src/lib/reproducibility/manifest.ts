import type {
  ExperimentManifest,
  ExperimentResults,
} from "./types";

interface ManifestInput {
  experimentName: string;
  description: string;
  author: string;
  tags: string[];
  dataset: {
    id: string;
    name: string;
    source?: string;
    questionCount: number;
  };
  config: Record<string, unknown>;
  results: {
    aggregatedMetrics: Record<string, number>;
    perQuestionMetrics: Array<{
      questionId: string;
      question: string;
      retrievalMetrics: Record<string, number> | null;
      generationMetrics: Record<string, number> | null;
      latencyMs: number;
    }>;
  };
}

function generateManifestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `manifest-${timestamp}-${random}`;
}

function computeChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function extractPipelineStages(
  config: Record<string, unknown>
): ExperimentManifest["pipeline"] {
  return {
    chunking: {
      name: String(config.chunkStrategy || config.chunkingStrategy || "fixed-size"),
      version: "1.0.0",
      parameters: {
        chunkSize: config.chunkSize || 512,
        chunkOverlap: config.chunkOverlap || 50,
        separators: config.separators || ["\n\n", "\n", ". "],
      },
      description: `Chunking strategy: ${config.chunkStrategy || config.chunkingStrategy || "fixed-size"}`,
    },
    embedding: {
      name: String(config.embeddingModel || "text-embedding-ada-002"),
      version: "1.0.0",
      parameters: {
        model: config.embeddingModel || "text-embedding-ada-002",
        dimensions: config.embeddingDimensions || 1536,
      },
      description: `Embedding model: ${config.embeddingModel || "text-embedding-ada-002"}`,
    },
    retrieval: {
      name: String(config.retrievalMode || config.retrievalStrategy || "vector"),
      version: "1.0.0",
      parameters: {
        strategy: config.retrievalMode || config.retrievalStrategy || "vector",
        topK: config.topK || 5,
        similarityThreshold: config.similarityThreshold || 0.7,
      },
      description: `Retrieval strategy: ${config.retrievalMode || config.retrievalStrategy || "vector"}`,
    },
    reranking: config.reranker
      ? {
          name: String(config.reranker),
          version: "1.0.0",
          parameters: {
            model: config.reranker,
            topN: config.rerankerTopN || 5,
          },
          description: `Reranker: ${config.reranker}`,
        }
      : null,
    prompt: {
      name: String(config.promptTemplate || "default"),
      version: "1.0.0",
      parameters: {
        template: config.promptTemplate || "default",
        maxTokens: config.maxPromptTokens || 4000,
      },
      description: `Prompt template: ${config.promptTemplate || "default"}`,
    },
    generation: {
      name: String(config.generationModel || config.llmModel || "gpt-4"),
      version: "1.0.0",
      parameters: {
        model: config.generationModel || config.llmModel || "gpt-4",
        temperature: config.temperature || 0.7,
        maxTokens: config.maxGenerationTokens || 1000,
      },
      description: `Generation model: ${config.generationModel || config.llmModel || "gpt-4"}`,
    },
    evaluation: {
      name: "kairos-evaluator",
      version: "1.0.0",
      parameters: {
        metrics: ["recall@K", "precision@K", "MRR", "nDCG", "hit_rate"],
      },
      description: "Kairos built-in evaluation pipeline",
    },
  };
}

function computeStatisticalSummary(
  perQuestionMetrics: ExperimentResults["perQuestionMetrics"]
): ExperimentResults["statisticalSummary"] {
  const allMetrics = new Set<string>();
  for (const q of perQuestionMetrics) {
    if (q.retrievalMetrics) Object.keys(q.retrievalMetrics).forEach((k) => allMetrics.add(`ret_${k}`));
    if (q.generationMetrics) Object.keys(q.generationMetrics).forEach((k) => allMetrics.add(`gen_${k}`));
  }

  const meanMetrics: Record<string, number> = {};
  const stdMetrics: Record<string, number> = {};
  const minMetrics: Record<string, number> = {};
  const maxMetrics: Record<string, number> = {};

  for (const metric of allMetrics) {
    const [prefix, ...nameParts] = metric.split("_");
    const key = nameParts.join("_");
    const values = perQuestionMetrics
      .map((q) => {
        const source = prefix === "ret" ? q.retrievalMetrics : q.generationMetrics;
        return source?.[key] ?? null;
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) continue;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    meanMetrics[metric] = mean;
    stdMetrics[metric] = Math.sqrt(variance);
    minMetrics[metric] = Math.min(...values);
    maxMetrics[metric] = Math.max(...values);
  }

  return { meanMetrics, stdMetrics, minMetrics, maxMetrics };
}

export function generateManifest(input: ManifestInput): ExperimentManifest {
  const { dataset, config, results } = input;

  const pipeline = extractPipelineStages(config);

  const experimentResults: ExperimentResults = {
    aggregatedMetrics: results.aggregatedMetrics,
    perQuestionMetrics: results.perQuestionMetrics,
    statisticalSummary: computeStatisticalSummary(results.perQuestionMetrics),
  };

  const manifest: ExperimentManifest = {
    manifestVersion: "1.0.0",
    manifestId: generateManifestId(),
    createdAt: new Date().toISOString(),
    experimentName: input.experimentName,
    description: input.description,
    author: input.author,
    tags: input.tags,
    dataset: {
      id: dataset.id,
      name: dataset.name,
      source: dataset.source || "unknown",
      questionCount: dataset.questionCount,
      checksum: computeChecksum(dataset),
    },
    pipeline,
    config,
    results: experimentResults,
    metadata: {
      kairosVersion: "2.0.0",
      environment: {
        nodeVersion: typeof process !== "undefined" ? process.version : "unknown",
        platform: typeof process !== "undefined" ? process.platform : "unknown",
      },
      dependencies: {},
    },
  };

  return manifest;
}

export function manifestToJSON(manifest: ExperimentManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function manifestToYAML(manifest: ExperimentManifest): string {
  const lines: string[] = [];

  lines.push(`manifestVersion: "${manifest.manifestVersion}"`);
  lines.push(`manifestId: "${manifest.manifestId}"`);
  lines.push(`createdAt: "${manifest.createdAt}"`);
  lines.push(`experimentName: "${manifest.experimentName}"`);
  lines.push(`description: "${manifest.description}"`);
  lines.push(`author: "${manifest.author}"`);
  lines.push("tags:");
  manifest.tags.forEach((t) => lines.push(`  - "${t}"`));

  lines.push("dataset:");
  lines.push(`  id: "${manifest.dataset.id}"`);
  lines.push(`  name: "${manifest.dataset.name}"`);
  lines.push(`  source: "${manifest.dataset.source}"`);
  lines.push(`  questionCount: ${manifest.dataset.questionCount}`);
  lines.push(`  checksum: "${manifest.dataset.checksum}"`);

  lines.push("pipeline:");
  for (const [stage, config] of Object.entries(manifest.pipeline)) {
    if (config === null) continue;
    lines.push(`  ${stage}:`);
    lines.push(`    name: "${config.name}"`);
    lines.push(`    version: "${config.version}"`);
    lines.push(`    description: "${config.description}"`);
    lines.push("    parameters:");
    for (const [k, v] of Object.entries(config.parameters)) {
      lines.push(`      ${k}: ${JSON.stringify(v)}`);
    }
  }

  lines.push("config:");
  for (const [k, v] of Object.entries(manifest.config)) {
    lines.push(`  ${k}: ${JSON.stringify(v)}`);
  }

  lines.push("results:");
  lines.push("  aggregatedMetrics:");
  for (const [k, v] of Object.entries(manifest.results.aggregatedMetrics)) {
    lines.push(`    ${k}: ${v}`);
  }

  lines.push("metadata:");
  lines.push(`  kairosVersion: "${manifest.metadata.kairosVersion}"`);

  return lines.join("\n");
}

export function parseManifest(json: string): ExperimentManifest {
  const data = JSON.parse(json) as ExperimentManifest;

  if (!data.manifestVersion || !data.manifestId || !data.experimentName) {
    throw new Error("Invalid manifest: missing required fields");
  }

  if (!data.dataset || !data.pipeline || !data.results) {
    throw new Error("Invalid manifest: missing dataset, pipeline, or results");
  }

  return data;
}

export function validateManifest(manifest: ExperimentManifest): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest.manifestVersion) errors.push("Missing manifestVersion");
  if (!manifest.manifestId) errors.push("Missing manifestId");
  if (!manifest.experimentName) errors.push("Missing experimentName");
  if (!manifest.createdAt) errors.push("Missing createdAt");

  if (!manifest.dataset?.id) errors.push("Missing dataset.id");
  if (!manifest.dataset?.name) errors.push("Missing dataset.name");
  if (!manifest.dataset?.questionCount || manifest.dataset.questionCount <= 0) {
    errors.push("Invalid dataset.questionCount");
  }

  const requiredStages = ["chunking", "embedding", "retrieval", "prompt", "generation", "evaluation"];
  for (const stage of requiredStages) {
    if (!manifest.pipeline?.[stage as keyof typeof manifest.pipeline]) {
      errors.push(`Missing pipeline stage: ${stage}`);
    }
  }

  if (!manifest.results?.aggregatedMetrics || Object.keys(manifest.results.aggregatedMetrics).length === 0) {
    warnings.push("No aggregated metrics in results");
  }

  if (!manifest.results?.perQuestionMetrics || manifest.results.perQuestionMetrics.length === 0) {
    warnings.push("No per-question metrics in results");
  }

  if (!manifest.metadata?.kairosVersion) {
    warnings.push("Missing Kairos version in metadata");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function computeManifestChecksum(manifest: ExperimentManifest): string {
  const data = {
    dataset: manifest.dataset,
    pipeline: manifest.pipeline,
    config: manifest.config,
    results: manifest.results.aggregatedMetrics,
  };
  return computeChecksum(data);
}
