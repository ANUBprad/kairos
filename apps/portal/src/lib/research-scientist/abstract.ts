import type { Finding, BenchmarkRunData, ExecutiveSummary, Threat } from "./types";
import { getBestConfigForMetric } from "./evidence";

export function generateAbstract(
  runs: BenchmarkRunData[],
  findings: Finding[],
  executiveSummary: ExecutiveSummary,
): string {
  const bestConfig = getBestConfigForMetric(runs, "avgRecallAtK");
  const significantFindings = findings.filter((f) => f.confidence > 0.7);
  const tradeoffs = findings.filter((f) => f.category === "tradeoff");

  const lines: string[] = [];

  lines.push("**Background:** Retrieval-Augmented Generation (RAG) systems require systematic evaluation to identify optimal configurations. This report presents a comprehensive analysis of benchmark results across multiple retrieval configurations.");

  lines.push("");

  const configCount = runs.length;
  const datasetName = runs[0]?.datasetName ?? "the evaluated dataset";
  lines.push(`**Methods:** We evaluated ${configCount} configurations on ${datasetName} using standard Information Retrieval metrics including Recall@K, Precision@K, MRR, nDCG, and Hit Rate. Statistical significance was assessed using paired t-tests and Wilcoxon signed-rank tests with α = 0.05.`);

  lines.push("");

  if (bestConfig) {
    lines.push(`**Results:** ${bestConfig.config} achieves the best overall performance with ${(bestConfig.value * 100).toFixed(1)}% Recall@K. ${significantFindings.length} statistically significant differences were identified across configurations.`);
  } else {
    lines.push("**Results:** Performance varied across configurations but no clear winner emerged from the available data.");
  }

  if (tradeoffs.length > 0) {
    lines.push(` Notable tradeoffs were observed, particularly ${tradeoffs[0].title.toLowerCase()}.`);
  }

  lines.push("");

  lines.push(`**Conclusions:** ${executiveSummary.overallConclusion} The research confidence is ${Math.round(executiveSummary.researchConfidence * 100)}%.`);

  return lines.join("\n");
}

export function generateConclusion(
  runs: BenchmarkRunData[],
  findings: Finding[],
  executiveSummary: ExecutiveSummary,
  threats: Threat[],
): string {
  const lines: string[] = [];

  lines.push("## Main Conclusions");
  lines.push("");

  lines.push(executiveSummary.overallConclusion);
  lines.push("");

  const bestConfig = getBestConfigForMetric(runs, "avgRecallAtK");
  if (bestConfig) {
    lines.push(`**Best Configuration:** ${bestConfig.config} (${(bestConfig.value * 100).toFixed(1)}% Recall@K)`);
    lines.push("");
  }

  lines.push("**Key Findings:**");
  for (const f of findings.filter((f) => f.severity === "high" || f.severity === "critical").slice(0, 3)) {
    lines.push(`- ${f.title}: ${f.interpretation}`);
  }
  lines.push("");

  const highThreats = threats.filter((t) => t.impact === "high");
  if (highThreats.length > 0) {
    lines.push("**Important Limitations:**");
    for (const t of highThreats) {
      lines.push(`- ${t.title}: ${t.mitigation}`);
    }
    lines.push("");
  }

  lines.push("**Confidence Assessment:**");
  lines.push(`The research confidence score is ${Math.round(executiveSummary.researchConfidence * 100)}%, `);
  if (executiveSummary.researchConfidence > 0.8) {
    lines.push("indicating high confidence in the conclusions. The evidence strongly supports the findings.");
  } else if (executiveSummary.researchConfidence > 0.5) {
    lines.push("indicating moderate confidence. While the findings are supported by evidence, additional experiments would strengthen the conclusions.");
  } else {
    lines.push("indicating low confidence. The conclusions should be treated as preliminary. More data is needed.");
  }
  lines.push("");

  lines.push("**Next Steps:**");
  lines.push(executiveSummary.nextExperiment);
  lines.push("");

  return lines.join("\n");
}
