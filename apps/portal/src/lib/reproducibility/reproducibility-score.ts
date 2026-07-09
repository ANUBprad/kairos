import type {
  ReproducibilityScore,
  ReproducibilityFactor,
  ExperimentManifest,
  ProvenanceChain,
} from "./types";

interface ScoreInput {
  manifest: ExperimentManifest;
  provenanceChain?: ProvenanceChain;
}

function computeConfigCompleteness(manifest: ExperimentManifest): number {
  let score = 0;
  let total = 0;

  const requiredStages = ["chunking", "embedding", "retrieval", "prompt", "generation", "evaluation"];
  for (const stage of requiredStages) {
    total += 1;
    const stageData = manifest.pipeline[stage as keyof typeof manifest.pipeline];
    if (stageData && stageData.name && stageData.version) {
      score += 0.5;
      if (Object.keys(stageData.parameters).length > 0) score += 0.5;
    }
  }

  total += 1;
  if (manifest.config && Object.keys(manifest.config).length > 0) {
    score += 1;
  }

  return Math.min(1, score / total);
}

function computeDataProvenance(manifest: ExperimentManifest): number {
  let score = 0;

  if (manifest.dataset.id) score += 0.25;
  if (manifest.dataset.name) score += 0.25;
  if (manifest.dataset.source && manifest.dataset.source !== "unknown") score += 0.25;
  if (manifest.dataset.checksum) score += 0.25;

  return score;
}

function computeEnvironmentCapture(manifest: ExperimentManifest): number {
  let score = 0;

  if (manifest.metadata.kairosVersion) score += 0.33;
  if (manifest.metadata.environment.nodeVersion && manifest.metadata.environment.nodeVersion !== "unknown") {
    score += 0.33;
  }
  if (manifest.metadata.environment.platform && manifest.metadata.environment.platform !== "unknown") {
    score += 0.34;
  }

  return score;
}

function computeDependencyLock(manifest: ExperimentManifest): number {
  const deps = manifest.metadata.dependencies;
  if (!deps || Object.keys(deps).length === 0) {
    return 0.2;
  }

  let lockedCount = 0;
  for (const [name, version] of Object.entries(deps)) {
    if (name && version && !version.startsWith("^") && !version.startsWith("~")) {
      lockedCount++;
    }
  }

  return Math.min(1, 0.2 + (lockedCount / Object.keys(deps).length) * 0.8);
}

function computeResultDeterminism(manifest: ExperimentManifest): number {
  let score = 0;

  if (manifest.results.aggregatedMetrics && Object.keys(manifest.results.aggregatedMetrics).length > 0) {
    score += 0.4;
  }

  if (manifest.results.perQuestionMetrics && manifest.results.perQuestionMetrics.length > 0) {
    score += 0.3;
  }

  if (manifest.results.statisticalSummary) {
    const hasStd = Object.values(manifest.results.statisticalSummary.stdMetrics).some((v) => v > 0);
    if (hasStd) score += 0.3;
  }

  return score;
}

function computeDocumentationQuality(manifest: ExperimentManifest): number {
  let score = 0;

  if (manifest.experimentName && manifest.experimentName.length > 5) score += 0.25;
  if (manifest.description && manifest.description.length > 20) score += 0.25;
  if (manifest.author) score += 0.25;
  if (manifest.tags && manifest.tags.length > 0) score += 0.25;

  return score;
}

function generateRecommendations(score: ReproducibilityScore): string[] {
  const recs: string[] = [];

  if (score.breakdown.configCompleteness < 0.7) {
    recs.push("Add more detailed configuration parameters for all pipeline stages.");
  }
  if (score.breakdown.dataProvenance < 0.7) {
    recs.push("Include dataset source and checksum for data traceability.");
  }
  if (score.breakdown.environmentCapture < 0.7) {
    recs.push("Capture runtime environment details (Node.js version, platform).");
  }
  if (score.breakdown.dependencyLock < 0.7) {
    recs.push("Lock dependency versions to exact versions (not ranges) for reproducibility.");
  }
  if (score.breakdown.resultDeterminism < 0.7) {
    recs.push("Include per-question metrics and statistical summaries for result verification.");
  }
  if (score.breakdown.documentationQuality < 0.7) {
    recs.push("Improve experiment documentation with descriptive name, description, author, and tags.");
  }

  if (score.overall < 0.5) {
    recs.push("Overall reproducibility is low. Focus on capturing all configuration and environment details.");
  } else if (score.overall < 0.8) {
    recs.push("Reproducibility is moderate. Consider adding provenance tracking and dependency locks.");
  }

  return recs;
}

export function computeReproducibilityScore(input: ScoreInput): ReproducibilityScore {
  const { manifest, provenanceChain } = input;

  const factors: ReproducibilityFactor[] = [
    {
      name: "Configuration Completeness",
      score: computeConfigCompleteness(manifest),
      weight: 0.2,
      description: "Completeness of pipeline configuration documentation",
      evidence: [
        `Pipeline stages: ${Object.keys(manifest.pipeline).filter((k) => manifest.pipeline[k as keyof typeof manifest.pipeline] !== null).length}/7`,
        `Config parameters: ${Object.keys(manifest.config).length}`,
      ],
    },
    {
      name: "Data Provenance",
      score: computeDataProvenance(manifest),
      weight: 0.15,
      description: "Traceability of dataset origin and integrity",
      evidence: [
        `Dataset ID: ${manifest.dataset.id ? "present" : "missing"}`,
        `Dataset source: ${manifest.dataset.source}`,
        `Checksum: ${manifest.dataset.checksum ? "present" : "missing"}`,
      ],
    },
    {
      name: "Environment Capture",
      score: computeEnvironmentCapture(manifest),
      weight: 0.15,
      description: "Documentation of runtime environment",
      evidence: [
        `Kairos version: ${manifest.metadata.kairosVersion || "missing"}`,
        `Node.js version: ${manifest.metadata.environment.nodeVersion || "missing"}`,
        `Platform: ${manifest.metadata.environment.platform || "missing"}`,
      ],
    },
    {
      name: "Dependency Lock",
      score: computeDependencyLock(manifest),
      weight: 0.15,
      description: "Pinning of dependency versions",
      evidence: [
        `Dependencies defined: ${Object.keys(manifest.metadata.dependencies).length}`,
      ],
    },
    {
      name: "Result Determinism",
      score: computeResultDeterminism(manifest),
      weight: 0.2,
      description: "Completeness and verifiability of results",
      evidence: [
        `Aggregated metrics: ${Object.keys(manifest.results.aggregatedMetrics).length}`,
        `Per-question results: ${manifest.results.perQuestionMetrics?.length || 0}`,
        `Statistical summary: ${manifest.results.statisticalSummary ? "present" : "missing"}`,
      ],
    },
    {
      name: "Documentation Quality",
      score: computeDocumentationQuality(manifest),
      weight: 0.15,
      description: "Quality of experiment documentation",
      evidence: [
        `Name: ${manifest.experimentName ? "present" : "missing"}`,
        `Description: ${manifest.description?.length || 0} chars`,
        `Author: ${manifest.author ? "present" : "missing"}`,
        `Tags: ${manifest.tags?.length || 0}`,
      ],
    },
  ];

  if (provenanceChain) {
    const provenanceScore = provenanceChain.integrity ? 1 : 0.5;
    factors.push({
      name: "Provenance Chain",
      score: provenanceScore,
      weight: 0.1,
      description: "Integrity of provenance tracking chain",
      evidence: [
        `Chain integrity: ${provenanceChain.integrity ? "valid" : "invalid"}`,
        `Records: ${provenanceChain.records.length}`,
      ],
    });
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const overall = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;

  const breakdown = {
    configCompleteness: factors[0].score,
    dataProvenance: factors[1].score,
    environmentCapture: factors[2].score,
    dependencyLock: factors[3].score,
    resultDeterminism: factors[4].score,
    documentationQuality: factors[5].score,
  };

  const score: ReproducibilityScore = {
    overall,
    breakdown,
    factors,
    recommendations: [],
  };

  score.recommendations = generateRecommendations(score);

  return score;
}

export function reproducibilityToMarkdown(score: ReproducibilityScore): string {
  const lines: string[] = [];

  lines.push("# Reproducibility Score");
  lines.push("");
  lines.push(`## Overall Score: ${(score.overall * 100).toFixed(1)}%`);
  lines.push("");

  lines.push("## Score Breakdown");
  lines.push("");
  lines.push("| Factor | Score | Weight |");
  lines.push("|--------|-------|--------|");
  for (const factor of score.factors) {
    lines.push(`| ${factor.name} | ${(factor.score * 100).toFixed(1)}% | ${(factor.weight * 100).toFixed(0)}% |`);
  }
  lines.push("");

  lines.push("## Detailed Factors");
  lines.push("");
  for (const factor of score.factors) {
    lines.push(`### ${factor.name}`);
    lines.push(`- Score: ${(factor.score * 100).toFixed(1)}%`);
    lines.push(`- Description: ${factor.description}`);
    lines.push("- Evidence:");
    for (const e of factor.evidence) {
      lines.push(`  - ${e}`);
    }
    lines.push("");
  }

  if (score.recommendations.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    for (const rec of score.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
