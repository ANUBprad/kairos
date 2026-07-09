import type { ConfigurationDimension, ConfigurationSpace } from "./types";

const DEFAULT_DIMENSIONS: ConfigurationDimension[] = [
  {
    name: "retrievalMode",
    type: "categorical",
    values: ["vector", "hybrid", "bm25", "keyword"],
    defaultValue: "vector",
    description: "Retrieval strategy used to find relevant documents",
  },
  {
    name: "chunkSize",
    type: "numeric",
    values: [256, 512, 1024, 2048],
    defaultValue: 512,
    description: "Size of text chunks in tokens",
  },
  {
    name: "chunkOverlap",
    type: "numeric",
    values: [0, 50, 100, 200],
    defaultValue: 50,
    description: "Overlap between consecutive chunks",
  },
  {
    name: "topK",
    type: "numeric",
    values: [3, 5, 10, 15, 20],
    defaultValue: 5,
    description: "Number of documents retrieved",
  },
  {
    name: "embeddingModel",
    type: "categorical",
    values: ["text-embedding-ada-002", "text-embedding-3-small", "text-embedding-3-large"],
    defaultValue: "text-embedding-ada-002",
    description: "Embedding model for document vectors",
  },
  {
    name: "reranker",
    type: "categorical",
    values: ["none", "cross-encoder", "cohere-rerank"],
    defaultValue: "none",
    description: "Reranking model for retrieved documents",
  },
  {
    name: "temperature",
    type: "numeric",
    values: [0.0, 0.3, 0.5, 0.7, 1.0],
    defaultValue: 0.7,
    description: "LLM temperature for generation",
  },
  {
    name: "useHybridWeight",
    type: "boolean",
    values: [true, false],
    defaultValue: false,
    description: "Whether to use custom hybrid retrieval weights",
  },
];

function getDimensionValues(
  runs: Array<{ config: Record<string, unknown> }>,
  dimension: ConfigurationDimension
): (string | number | boolean)[] {
  const observed = new Set<string | number | boolean>();

  for (const run of runs) {
    const val = run.config[dimension.name];
    if (val !== undefined && val !== null) {
      if (dimension.type === "categorical") {
        observed.add(String(val));
      } else if (dimension.type === "numeric" && typeof val === "number") {
        observed.add(val);
      } else if (dimension.type === "boolean" && typeof val === "boolean") {
        observed.add(val);
      }
    }
  }

  const allValues = new Set([...dimension.values, ...observed]);
  return Array.from(allValues);
}

export function analyzeConfigurationSpace(
  runs: Array<{ config: Record<string, unknown> }>
): ConfigurationSpace {
  const dimensions: ConfigurationDimension[] = DEFAULT_DIMENSIONS.map((dim) => ({
    ...dim,
    values: getDimensionValues(runs, dim),
  }));

  const observedKeys = new Set<string>();
  for (const run of runs) {
    Object.keys(run.config).forEach((k) => observedKeys.add(k));
  }

  for (const key of observedKeys) {
    if (!dimensions.find((d) => d.name === key)) {
      const values = new Set<string | number | boolean>();
      for (const run of runs) {
        const val = run.config[key];
        if (val !== undefined && val !== null) {
          values.add(String(val));
        }
      }
      dimensions.push({
        name: key,
        type: "categorical",
        values: Array.from(values),
        defaultValue: Array.from(values)[0] ?? "",
        description: `Custom parameter: ${key}`,
      });
    }
  }

  let totalCombinations = 1;
  for (const dim of dimensions) {
    totalCombinations *= dim.values.length;
  }

  return {
    dimensions,
    totalCombinations,
  };
}

export function generateAllCombinations(space: ConfigurationSpace): Array<Record<string, string | number | boolean>> {
  const combinations: Array<Record<string, string | number | boolean>> = [];

  function backtrack(index: number, current: Record<string, string | number | boolean>) {
    if (index === space.dimensions.length) {
      combinations.push({ ...current });
      return;
    }

    const dim = space.dimensions[index];
    for (const value of dim.values) {
      current[dim.name] = value;
      backtrack(index + 1, current);
    }
  }

  backtrack(0, {});
  return combinations;
}

export function configToKey(config: Record<string, string | number | boolean>): string {
  return Object.entries(config)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("|");
}

export function keyToConfig(key: string): Record<string, string | number | boolean> {
  const config: Record<string, string | number | boolean> = {};
  for (const part of key.split("|")) {
    const [k, ...vParts] = part.split("=");
    const v = vParts.join("=");
    if (v === "true") config[k] = true;
    else if (v === "false") config[k] = false;
    else if (!isNaN(Number(v))) config[k] = Number(v);
    else config[k] = v;
  }
  return config;
}

export function getExploredConfigs(runs: Array<{ config: Record<string, unknown> }>): Set<string> {
  const explored = new Set<string>();
  for (const run of runs) {
    const config: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(run.config)) {
      if (v !== undefined && v !== null) {
        config[k] = v as string | number | boolean;
      }
    }
    explored.add(configToKey(config));
  }
  return explored;
}

export function findNearestNeighbor(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown> }>,
  dimensions: ConfigurationDimension[]
): { distance: number; runIndex: number } | null {
  if (runs.length === 0) return null;

  let minDist = Infinity;
  let minIdx = 0;

  for (let i = 0; i < runs.length; i++) {
    const dist = configDistance(target, runs[i].config as Record<string, string | number | boolean>, dimensions);
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }

  return { distance: minDist, runIndex: minIdx };
}

export function configDistance(
  a: Record<string, string | number | boolean>,
  b: Record<string, string | number | boolean>,
  dimensions: ConfigurationDimension[]
): number {
  let sumSq = 0;
  let count = 0;

  for (const dim of dimensions) {
    const valA = a[dim.name];
    const valB = b[dim.name];

    if (valA === undefined || valB === undefined) continue;

    if (dim.type === "numeric" && typeof valA === "number" && typeof valB === "number") {
      const range = Math.max(...dim.values.map(Number)) - Math.min(...dim.values.map(Number));
      const norm = range > 0 ? (valA - valB) / range : 0;
      sumSq += norm * norm;
    } else if (dim.type === "categorical") {
      sumSq += valA === valB ? 0 : 1;
    } else if (dim.type === "boolean") {
      sumSq += valA === valB ? 0 : 1;
    }
    count++;
  }

  return count > 0 ? Math.sqrt(sumSq / count) : 0;
}
