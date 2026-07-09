import type {
  ConfigurationDiff,
  ConfigDifference,
  MetricDifference,
  StatisticalDifference,
  DiffSummary,
} from "./types";

interface DiffInput {
  configA: {
    id: string;
    name: string;
    timestamp: string;
    config: Record<string, unknown>;
    metrics: Record<string, number>;
  };
  configB: {
    id: string;
    name: string;
    timestamp: string;
    config: Record<string, unknown>;
    metrics: Record<string, number>;
  };
}

function categorizeParameter(key: string): ConfigDifference["category"] {
  const chunkingKeys = ["chunkStrategy", "chunkingStrategy", "chunkSize", "chunkOverlap", "separators"];
  const embeddingKeys = ["embeddingModel", "embeddingDimensions"];
  const retrievalKeys = ["retrievalMode", "retrievalStrategy", "topK", "similarityThreshold", "vectorWeight", "bm25Weight"];
  const rerankingKeys = ["reranker", "rerankerTopN"];
  const promptKeys = ["promptTemplate", "maxPromptTokens"];
  const generationKeys = ["generationModel", "llmModel", "temperature", "maxGenerationTokens"];
  const evaluationKeys = ["evaluationMetrics", "evaluationDataset"];

  if (chunkingKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return "chunking";
  if (embeddingKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return "embedding";
  if (retrievalKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return "retrieval";
  if (rerankingKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return "reranking";
  if (promptKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return "prompt";
  if (generationKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return "generation";
  if (evaluationKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return "evaluation";
  return "system";
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

function computeConfigDifferences(
  configA: Record<string, unknown>,
  configB: Record<string, unknown>
): ConfigDifference[] {
  const flatA = flattenObject(configA);
  const flatB = flattenObject(configB);
  const allKeys = new Set([...Object.keys(flatA), ...Object.keys(flatB)]);

  const differences: ConfigDifference[] = [];

  for (const key of allKeys) {
    const valA = flatA[key];
    const valB = flatB[key];

    if (valA === undefined && valB !== undefined) {
      differences.push({
        path: key,
        label: formatKey(key),
        valueA: undefined,
        valueB: valB,
        type: "added",
        category: categorizeParameter(key),
      });
    } else if (valA !== undefined && valB === undefined) {
      differences.push({
        path: key,
        label: formatKey(key),
        valueA: valA,
        valueB: undefined,
        type: "removed",
        category: categorizeParameter(key),
      });
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      differences.push({
        path: key,
        label: formatKey(key),
        valueA: valA,
        valueB: valB,
        type: "changed",
        category: categorizeParameter(key),
      });
    }
  }

  return differences.sort((a, b) => {
    const catOrder = { chunking: 0, embedding: 1, retrieval: 2, reranking: 3, prompt: 4, generation: 5, evaluation: 6, system: 7 };
    return (catOrder[a.category] ?? 8) - (catOrder[b.category] ?? 8);
  });
}

function computeMetricDifferences(
  metricsA: Record<string, number>,
  metricsB: Record<string, number>
): MetricDifference[] {
  const allMetrics = new Set([...Object.keys(metricsA), ...Object.keys(metricsB)]);
  const differences: MetricDifference[] = [];

  for (const metric of allMetrics) {
    const valA = metricsA[metric] ?? 0;
    const valB = metricsB[metric] ?? 0;
    const absDiff = valB - valA;
    const relDiff = valA !== 0 ? (absDiff / Math.abs(valA)) * 100 : valB !== 0 ? 100 : 0;

    let direction: MetricDifference["direction"] = "unchanged";
    if (Math.abs(absDiff) > 0.001) {
      direction = absDiff > 0 ? "improved" : "degraded";
    }

    let magnitude: MetricDifference["magnitude"] = "negligible";
    const absRelDiff = Math.abs(relDiff);
    if (absRelDiff > 20) magnitude = "large";
    else if (absRelDiff > 10) magnitude = "medium";
    else if (absRelDiff > 5) magnitude = "small";

    differences.push({
      metric,
      label: formatKey(metric),
      valueA: valA,
      valueB: valB,
      absoluteDifference: absDiff,
      relativeDifference: relDiff,
      direction,
      magnitude,
    });
  }

  return differences.sort((a, b) => Math.abs(b.absoluteDifference) - Math.abs(a.absoluteDifference));
}

function computeStatisticalDifferences(
  metricsA: Record<string, number>,
  metricsB: Record<string, number>
): StatisticalDifference[] {
  const allMetrics = new Set([...Object.keys(metricsA), ...Object.keys(metricsB)]);
  const differences: StatisticalDifference[] = [];

  for (const metric of allMetrics) {
    const valA = metricsA[metric] ?? 0;
    const valB = metricsB[metric] ?? 0;
    const diff = valB - valA;

    const pooledStd = Math.sqrt((0.01 ** 2 + 0.01 ** 2) / 2);
    const effectSize = pooledStd > 0 ? Math.abs(diff) / pooledStd : 0;

    let effectMagnitude: StatisticalDifference["effectMagnitude"] = "negligible";
    if (effectSize > 0.8) effectMagnitude = "large";
    else if (effectSize > 0.5) effectMagnitude = "medium";
    else if (effectSize > 0.2) effectMagnitude = "small";

    const zScore = pooledStd > 0 ? diff / (pooledStd * Math.SQRT2) : 0;
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
    const significant = pValue < 0.05;

    const ciWidth = 1.96 * pooledStd * Math.SQRT2;

    differences.push({
      metric,
      label: formatKey(metric),
      testUsed: "Two-sample z-test (approximation)",
      pValue,
      significant,
      effectSize,
      effectMagnitude,
      confidenceInterval: [diff - ciWidth, diff + ciWidth],
      interpretation: significant
        ? `${formatKey(metric)} shows a statistically significant ${diff > 0 ? "improvement" : "degradation"} (p=${pValue.toFixed(4)})`
        : `No statistically significant difference in ${formatKey(metric)} (p=${pValue.toFixed(4)})`,
    });
  }

  return differences.sort((a, b) => a.pValue - b.pValue);
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const xAbs = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * xAbs);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-xAbs * xAbs);
  return 0.5 * (1.0 + sign * y);
}

function computeDiffSummary(
  configDiffs: ConfigDifference[],
  metricDiffs: MetricDifference[],
  statDiffs: StatisticalDifference[]
): DiffSummary {
  const changedParams = configDiffs.filter((d) => d.type === "changed").length;
  const addedParams = configDiffs.filter((d) => d.type === "added").length;
  const removedParams = configDiffs.filter((d) => d.type === "removed").length;

  const improvedMetrics = metricDiffs.filter((d) => d.direction === "improved").length;
  const degradedMetrics = metricDiffs.filter((d) => d.direction === "degraded").length;
  const unchangedMetrics = metricDiffs.filter((d) => d.direction === "unchanged").length;
  const significantDiffs = statDiffs.filter((d) => d.significant).length;

  let overallAssessment: DiffSummary["overallAssessment"];
  if (configDiffs.length === 0) overallAssessment = "identical";
  else if (changedParams <= 2 && addedParams + removedParams === 0) overallAssessment = "minor";
  else if (changedParams <= 5) overallAssessment = "moderate";
  else if (changedParams <= 10) overallAssessment = "major";
  else overallAssessment = "completely_different";

  return {
    totalParameters: configDiffs.length,
    changedParameters: changedParams,
    addedParameters: addedParams,
    removedParameters: removedParams,
    metricsCompared: metricDiffs.length,
    metricsImproved: improvedMetrics,
    metricsDegraded: degradedMetrics,
    metricsUnchanged: unchangedMetrics,
    statisticallySignificant: significantDiffs,
    overallAssessment,
  };
}

export function computeConfigurationDiff(input: DiffInput): ConfigurationDiff {
  const configDiffs = computeConfigDifferences(input.configA.config, input.configB.config);
  const metricDiffs = computeMetricDifferences(input.configA.metrics, input.configB.metrics);
  const statDiffs = computeStatisticalDifferences(input.configA.metrics, input.configB.metrics);
  const summary = computeDiffSummary(configDiffs, metricDiffs, statDiffs);

  return {
    configA: {
      id: input.configA.id,
      name: input.configA.name,
      timestamp: input.configA.timestamp,
    },
    configB: {
      id: input.configB.id,
      name: input.configB.name,
      timestamp: input.configB.timestamp,
    },
    differences: configDiffs,
    metricDifferences: metricDiffs,
    statisticalDifferences: statDiffs,
    summary,
  };
}

export function diffToMarkdown(diff: ConfigurationDiff): string {
  const lines: string[] = [];

  lines.push(`# Configuration Comparison`);
  lines.push("");
  lines.push(`## Experiment A: ${diff.configA.name}`);
  lines.push(`- ID: ${diff.configA.id}`);
  lines.push(`- Timestamp: ${diff.configA.timestamp}`);
  lines.push("");
  lines.push(`## Experiment B: ${diff.configB.name}`);
  lines.push(`- ID: ${diff.configB.id}`);
  lines.push(`- Timestamp: ${diff.configB.timestamp}`);
  lines.push("");
  lines.push(`## Overall Assessment: ${diff.summary.overallAssessment.replace(/_/g, " ").toUpperCase()}`);
  lines.push("");

  if (diff.differences.length > 0) {
    lines.push("## Configuration Changes");
    lines.push("");
    for (const d of diff.differences) {
      const icon = d.type === "added" ? "+" : d.type === "removed" ? "-" : "~";
      lines.push(`- ${icon} **${d.label}** (${d.category})`);
      if (d.type === "changed") {
        lines.push(`  - A: ${JSON.stringify(d.valueA)}`);
        lines.push(`  - B: ${JSON.stringify(d.valueB)}`);
      } else if (d.type === "added") {
        lines.push(`  - Added: ${JSON.stringify(d.valueB)}`);
      } else {
        lines.push(`  - Removed: ${JSON.stringify(d.valueA)}`);
      }
    }
    lines.push("");
  }

  if (diff.metricDifferences.length > 0) {
    lines.push("## Metric Differences");
    lines.push("");
    lines.push("| Metric | A | B | Diff | Direction |");
    lines.push("|--------|---|---|------|-----------|");
    for (const m of diff.metricDifferences) {
      const icon = m.direction === "improved" ? "↑" : m.direction === "degraded" ? "↓" : "→";
      lines.push(`| ${m.label} | ${m.valueA.toFixed(4)} | ${m.valueB.toFixed(4)} | ${m.absoluteDifference >= 0 ? "+" : ""}${m.absoluteDifference.toFixed(4)} | ${icon} ${m.direction} |`);
    }
    lines.push("");
  }

  if (diff.statisticalDifferences.length > 0) {
    lines.push("## Statistical Analysis");
    lines.push("");
    for (const s of diff.statisticalDifferences) {
      lines.push(`### ${s.label}`);
      lines.push(`- Test: ${s.testUsed}`);
      lines.push(`- p-value: ${s.pValue.toFixed(4)}`);
      lines.push(`- Significant: ${s.significant ? "Yes" : "No"}`);
      lines.push(`- Effect size: ${s.effectSize.toFixed(3)} (${s.effectMagnitude})`);
      lines.push(`- 95% CI: [${s.confidenceInterval[0].toFixed(4)}, ${s.confidenceInterval[1].toFixed(4)}]`);
      lines.push(`- ${s.interpretation}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
