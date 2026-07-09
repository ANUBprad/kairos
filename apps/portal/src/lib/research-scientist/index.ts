import type {
  ResearchScientistInput,
  ResearchPaper,
  ExecutiveSummary,
  Finding,
  DiscussionPoint,
  Threat,
  FutureWorkItem,
  Recommendation,
} from "./types";
import type { BenchmarkRunData } from "./types";
import { generateFindings } from "./findings";
import { generateDiscussion } from "./discussion";
import { generateThreats } from "./threats";
import { generateFutureWork } from "./future-work";
import { generateExecutiveSummary } from "./executive-summary";
import { generateAbstract, generateConclusion } from "./abstract";
import { generateRecommendations } from "./recommendations";
import { computeResearchConfidence, getConfidenceLabel } from "./confidence";
import { generateAllPairwiseEvidence } from "./evidence";

export interface ResearchScientistResult {
  paper: ResearchPaper;
  confidence: number;
  confidenceLabel: string;
  recommendations: Recommendation[];
  evidenceCount: number;
}

export function generateResearchPaper(input: ResearchScientistInput): ResearchScientistResult {
  const { runs, datasetName, totalQuestions } = input;

  const findings = generateFindings(runs);
  const discussion = generateDiscussion(runs, findings);
  const threats = generateThreats(runs, totalQuestions);
  const futureWork = generateFutureWork(runs, findings);
  const allEvidence = generateAllPairwiseEvidence(runs);
  const researchConfidence = computeResearchConfidence(runs, findings, threats, allEvidence);
  const confidenceLabel = getConfidenceLabel(researchConfidence);
  const executiveSummary = generateExecutiveSummary(runs, findings, threats, researchConfidence);
  const abstractText = generateAbstract(runs, findings, executiveSummary);
  const conclusionText = generateConclusion(runs, findings, executiveSummary, threats);
  const recommendations = generateRecommendations(runs, findings);

  const markdown = renderMarkdown(
    executiveSummary,
    abstractText,
    findings,
    discussion,
    threats,
    futureWork,
    conclusionText,
    recommendations,
    researchConfidence,
    runs,
  );

  const json = JSON.stringify({
    executiveSummary,
    findings,
    discussion,
    threats,
    futureWork,
    conclusion: conclusionText,
    recommendations,
    confidence: researchConfidence,
    metadata: {
      datasetName,
      totalQuestions,
      totalRuns: runs.length,
      generatedAt: new Date().toISOString(),
    },
  }, null, 2);

  return {
    paper: {
      abstract: abstractText,
      executiveSummary,
      findings,
      discussion,
      threats,
      futureWork,
      conclusion: conclusionText,
      markdown,
      json,
    },
    confidence: researchConfidence,
    confidenceLabel,
    recommendations,
    evidenceCount: allEvidence.length,
  };
}

function renderMarkdown(
  executiveSummary: ExecutiveSummary,
  abstractText: string,
  findings: Finding[],
  discussion: DiscussionPoint[],
  threats: Threat[],
  futureWork: FutureWorkItem[],
  conclusionText: string,
  recommendations: Recommendation[],
  confidence: number,
  runs: BenchmarkRunData[],
): string {
  const lines: string[] = [];

  lines.push("# Research Analysis Report", "");
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push(`**Dataset:** ${runs[0]?.datasetName ?? "Unknown"}`);
  lines.push(`**Configurations Analyzed:** ${runs.length}`);
  lines.push(`**Research Confidence:** ${Math.round(confidence * 100)}%`);
  lines.push("");

  lines.push("---", "");
  lines.push("## Abstract", "");
  lines.push(abstractText);
  lines.push("");

  lines.push("---", "");
  lines.push("## Executive Summary", "");
  lines.push(`**Overall Conclusion:** ${executiveSummary.overallConclusion}`);
  lines.push("");
  lines.push(`**Best Configuration:** ${executiveSummary.bestConfiguration}`);
  lines.push("");
  lines.push(`**Most Important Finding:** ${executiveSummary.mostImportantFinding}`);
  lines.push("");
  lines.push(`**Most Surprising Observation:** ${executiveSummary.mostSurprisingObservation}`);
  lines.push("");
  lines.push(`**Recommended Deployment:** ${executiveSummary.recommendedDeployment}`);
  lines.push("");
  lines.push(`**Next Experiment:** ${executiveSummary.nextExperiment}`);
  lines.push("");

  lines.push("---", "");
  lines.push("## Key Findings", "");
  for (const f of findings) {
    lines.push(`### ${f.title}`);
    lines.push("");
    lines.push(f.statement);
    lines.push("");
    if (f.evidence.length > 0) {
      lines.push("**Evidence:**");
      for (const e of f.evidence) {
        lines.push(`- ${e.metric}: ${e.improvementPct > 0 ? "+" : ""}${e.improvementPct.toFixed(1)}% (${e.configs.join(" vs ")})`);
        lines.push(`  - ${e.pValue < 0.001 ? "p < 0.001" : `p = ${e.pValue.toFixed(3)}`}, ${e.effectMagnitude} effect`);
      }
      lines.push("");
    }
    lines.push(`**Interpretation:** ${f.interpretation}`);
    lines.push("");
  }

  lines.push("---", "");
  lines.push("## Discussion", "");
  for (const d of discussion) {
    lines.push(`### ${d.topic}`);
    lines.push("");
    lines.push(`**Observation:** ${d.observation}`);
    lines.push("");
    lines.push(`**Explanation:** ${d.explanation}`);
    lines.push("");
    if (d.implications.length > 0) {
      lines.push("**Implications:**");
      for (const imp of d.implications) {
        lines.push(`- ${imp}`);
      }
      lines.push("");
    }
  }

  lines.push("---", "");
  lines.push("## Threats to Validity", "");
  for (const t of threats) {
    lines.push(`### ${t.title}`);
    lines.push("");
    lines.push(`**Category:** ${t.category}`);
    lines.push("");
    lines.push(t.description);
    lines.push("");
    lines.push(`**Impact:** ${t.impact}`);
    lines.push("");
    lines.push(`**Mitigation:** ${t.mitigation}`);
    lines.push("");
  }

  lines.push("---", "");
  lines.push("## Future Work", "");
  for (const fw of futureWork) {
    lines.push(`### ${fw.title}`);
    lines.push("");
    lines.push(`**Rationale:** ${fw.rationale}`);
    lines.push("");
    lines.push(`**Expected Impact:** ${fw.expectedImpact}`);
    lines.push("");
    lines.push(`**Priority:** ${fw.priority}`);
    lines.push("");
    if (fw.missingEvidence.length > 0) {
      lines.push("**Missing Evidence:**");
      for (const me of fw.missingEvidence) {
        lines.push(`- ${me}`);
      }
      lines.push("");
    }
  }

  lines.push("---", "");
  lines.push("## Recommendations", "");
  for (const r of recommendations) {
    lines.push(`### ${r.title}`);
    lines.push("");
    lines.push(r.description);
    lines.push("");
    lines.push(`**Priority:** ${r.priority}`);
    lines.push("");
    lines.push(`**Expected Impact:** ${r.expectedImpact}`);
    lines.push("");
  }

  lines.push("---", "");
  lines.push(conclusionText);

  lines.push("---", "");
  lines.push(`_Report generated by Kairos Research Scientist v1.0_`);

  return lines.join("\n");
}
