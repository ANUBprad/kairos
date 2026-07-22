"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ExplainerChunk, ExplainerCitation } from "./types";

interface AnswerConfidencePanelProps {
  chunks: ExplainerChunk[];
  citations: ExplainerCitation[];
  answerText?: string;
  className?: string;
}

interface ConfidenceResult {
  score: number;
  label: string;
  color: string;
  factors: {
    name: string;
    score: number;
    description: string;
  }[];
}

function computeConfidence(
  chunks: ExplainerChunk[],
  citations: ExplainerCitation[],
  answerText?: string
): ConfidenceResult {
  const factors: ConfidenceResult["factors"] = [];

  // Factor 1: Average similarity
  const avgSim = chunks.length > 0
    ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
    : 0;
  factors.push({
    name: "Average Similarity",
    score: avgSim,
    description: `Average chunk similarity is ${(avgSim * 100).toFixed(1)}%`,
  });

  // Factor 2: Max similarity
  const maxSim = chunks.length > 0 ? Math.max(...chunks.map((c) => c.similarity)) : 0;
  factors.push({
    name: "Best Match",
    score: maxSim,
    description: `Highest chunk similarity is ${(maxSim * 100).toFixed(1)}%`,
  });

  // Factor 3: Chunk count
  const chunkScore = Math.min(1, chunks.length / 5);
  factors.push({
    name: "Evidence Volume",
    score: chunkScore,
    description: `${chunks.length} chunk${chunks.length !== 1 ? "s" : ""} retrieved as evidence`,
  });

  // Factor 4: Citation coverage
  const citationScore = citations.length > 0 ? Math.min(1, citations.length / 3) : 0;
  factors.push({
    name: "Citation Coverage",
    score: citationScore,
    description: `${citations.length} citation${citations.length !== 1 ? "s" : ""} mapped to answer`,
  });

  // Factor 5: Answer length (heuristic)
  const answerLen = answerText?.length || 0;
  const answerScore = answerLen > 100 ? 0.8 : answerLen > 50 ? 0.6 : answerLen > 0 ? 0.4 : 0;
  factors.push({
    name: "Response Completeness",
    score: answerScore,
    description: answerLen > 0 ? `${answerLen} characters in response` : "No response yet",
  });

  // Compute weighted score
  const weights = [0.25, 0.2, 0.15, 0.2, 0.2];
  const totalScore = factors.reduce((sum, f, i) => sum + f.score * (weights[i] || 0.2), 0);
  const normalizedScore = Math.min(1, totalScore / weights.reduce((a, b) => a + b, 0));

  let label: string;
  let color: string;
  if (normalizedScore >= 0.8) {
    label = "High Confidence";
    color = "text-success";
  } else if (normalizedScore >= 0.6) {
    label = "Moderate Confidence";
    color = "text-brand";
  } else if (normalizedScore >= 0.4) {
    label = "Low Confidence";
    color = "text-warning";
  } else {
    label = "Very Low Confidence";
    color = "text-error";
  }

  return { score: normalizedScore, label, color, factors };
}

export function AnswerConfidencePanel({ chunks, citations, answerText, className }: AnswerConfidencePanelProps) {
  const result = useMemo(() => computeConfidence(chunks, citations, answerText), [chunks, citations, answerText]);

  const scorePercentage = Math.round(result.score * 100);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Score Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <svg width="64" height="64" className="-rotate-90">
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-surface-hover"
            />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={175.9}
              strokeDashoffset={175.9 - (175.9 * scorePercentage) / 100}
              className={cn(
                "transition-all duration-700",
                result.score >= 0.8 ? "stroke-success" :
                result.score >= 0.6 ? "stroke-brand" :
                result.score >= 0.4 ? "stroke-warning" : "stroke-error"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-sm font-bold font-mono", result.color)}>
              {scorePercentage}%
            </span>
          </div>
        </div>
        <div>
          <p className={cn("text-sm font-semibold", result.color)}>{result.label}</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            Based on {result.factors.length} factors
          </p>
        </div>
      </div>

      {/* Factors */}
      <div className="space-y-2">
        {result.factors.map((factor) => (
          <div key={factor.name} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-text-secondary">{factor.name}</span>
                <span className="text-[10px] font-mono text-text-tertiary">
                  {Math.round(factor.score * 100)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    factor.score >= 0.8 ? "bg-success" :
                    factor.score >= 0.6 ? "bg-brand" :
                    factor.score >= 0.4 ? "bg-warning" : "bg-error"
                  )}
                  style={{ width: `${factor.score * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-text-tertiary mt-0.5">{factor.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
