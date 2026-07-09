import type { CopilotEvidence, CopilotContext } from "./types";

interface GroundingResult {
  isGrounded: boolean;
  groundedClaims: GroundedClaim[];
  ungroundedClaims: string[];
  confidence: number;
}

interface GroundedClaim {
  claim: string;
  evidence: CopilotEvidence[];
  supportLevel: "strong" | "moderate" | "weak";
}

export function groundResponse(
  response: string,
  evidence: CopilotEvidence[],
  _context: CopilotContext
): GroundingResult {
  const claims = extractClaims(response);
  const groundedClaims: GroundedClaim[] = [];
  const ungroundedClaims: string[] = [];

  for (const claim of claims) {
    const supportingEvidence = findSupportingEvidence(claim, evidence);
    const supportLevel = assessSupportLevel(supportingEvidence);

    if (supportLevel !== "weak") {
      groundedClaims.push({
        claim,
        evidence: supportingEvidence,
        supportLevel,
      });
    } else {
      ungroundedClaims.push(claim);
    }
  }

  const totalClaims = claims.length;
  const groundedCount = groundedClaims.length;
  const confidence = totalClaims > 0 ? groundedCount / totalClaims : 0.5;

  return {
    isGrounded: ungroundedClaims.length === 0,
    groundedClaims,
    ungroundedClaims,
    confidence,
  };
}

function extractClaims(response: string): string[] {
  const claims: string[] = [];

  const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (isClaim(trimmed)) {
      claims.push(trimmed);
    }
  }

  return claims;
}

function isClaim(sentence: string): boolean {
  const claimPatterns = [
    /(?:is|are|was|were|has|have|had|does|do|did)\s+/i,
    /(?:improve|increase|decrease|outperform|better|worse)/i,
    /(?:significant|statistically|confident|recommended)/i,
    /(?:\d+\.?\d*\s*%)/,
    /(?:p\s*[=<]\s*0?\.\d+)/i,
  ];

  return claimPatterns.some((p) => p.test(sentence));
}

function findSupportingEvidence(claim: string, evidence: CopilotEvidence[]): CopilotEvidence[] {
  const supporting: CopilotEvidence[] = [];
  const claimLower = claim.toLowerCase();

  for (const e of evidence) {
    const dataStr = JSON.stringify(e.data).toLowerCase();
    const sourceStr = e.source.toLowerCase();

    const relevance = computeEvidenceRelevance(claimLower, dataStr, sourceStr);

    if (relevance > 0.3) {
      supporting.push(e);
    }
  }

  return supporting;
}

function computeEvidenceRelevance(claimLower: string, dataStr: string, sourceStr: string): number {
  let relevance = 0;

  const claimWords = claimLower.split(/\s+/).filter((w) => w.length > 3);

  for (const word of claimWords) {
    if (dataStr.includes(word)) relevance += 0.1;
    if (sourceStr.includes(word)) relevance += 0.05;
  }

  const metricPatterns = [
    /recall/i, /precision/i, /mrr/i, /ndcg/i, /hit\s+rate/i,
    /latency/i, /accuracy/i, /f1/i,
  ];

  for (const pattern of metricPatterns) {
    if (pattern.test(claimLower) && pattern.test(dataStr)) {
      relevance += 0.2;
    }
  }

  const numberPattern = /(\d+\.?\d*)\s*%?/g;
  const claimNumbers = (claimLower.match(numberPattern) || []) as string[];
  const dataNumbers = (dataStr.match(numberPattern) || []) as string[];

  for (const num of claimNumbers) {
    if (dataNumbers.includes(num)) {
      relevance += 0.3;
    }
  }

  return Math.min(1, relevance);
}

function assessSupportLevel(evidence: CopilotEvidence[]): "strong" | "moderate" | "weak" {
  if (evidence.length >= 3) return "strong";
  if (evidence.length >= 1) return "moderate";
  return "weak";
}

export function generateGroundingSummary(result: GroundingResult): string {
  const parts: string[] = [];

  parts.push(`${result.groundedClaims.length} claims supported by evidence`);

  if (result.ungroundedClaims.length > 0) {
    parts.push(`${result.ungroundedClaims.length} claims without direct evidence`);
  }

  const strongCount = result.groundedClaims.filter((c) => c.supportLevel === "strong").length;
  if (strongCount > 0) {
    parts.push(`${strongCount} strongly supported`);
  }

  return parts.join(". ");
}

export function addCitationsToResponse(
  response: string,
  groundedClaims: GroundedClaim[]
): string {
  let citedResponse = response;

  for (const claim of groundedClaims) {
    if (claim.evidence.length > 0) {
      const citation = claim.evidence
        .slice(0, 2)
        .map((e) => e.source)
        .join(", ");

      const claimEnd = citedResponse.indexOf(claim.claim) + claim.claim.length;
      if (claimEnd > claim.claim.length) {
        citedResponse =
          citedResponse.slice(0, claimEnd) +
          ` [${citation}]` +
          citedResponse.slice(claimEnd);
      }
    }
  }

  return citedResponse;
}
