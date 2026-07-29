"use client";

import { useState, useMemo } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Medal,
  Award,
  Clock,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Types
type LeaderboardType =
  | "prompt-versions"
  | "models"
  | "retrievers"
  | "chunkers"
  | "embedding-models"
  | "experiments";

type TimePeriod = "7d" | "30d" | "90d" | "all";

type Trend = "up" | "stable" | "down";

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  metrics: { label: string; value: string; variant: "success" | "warning" | "info" | "default" }[];
  trend: Trend;
  trendValue: string;
}

interface LeaderboardConfig {
  label: string;
  sortOptions: { key: string; label: string }[];
}

// Configuration
const LEADERBOARD_CONFIGS: Record<LeaderboardType, LeaderboardConfig> = {
  "prompt-versions": {
    label: "Prompt Versions",
    sortOptions: [
      { key: "composite", label: "Composite Score" },
      { key: "accuracy", label: "Accuracy" },
      { key: "relevance", label: "Relevance" },
    ],
  },
  models: {
    label: "Models",
    sortOptions: [
      { key: "quality", label: "Quality Score" },
      { key: "latency", label: "Latency" },
      { key: "cost", label: "Cost Efficiency" },
    ],
  },
  retrievers: {
    label: "Retrievers",
    sortOptions: [
      { key: "recall", label: "Recall@k" },
      { key: "precision", label: "Precision" },
      { key: "mrr", label: "MRR" },
    ],
  },
  chunkers: {
    label: "Chunkers",
    sortOptions: [
      { key: "coherence", label: "Coherence" },
      { key: "coverage", label: "Coverage" },
      { key: "overlap", label: "Overlap Quality" },
    ],
  },
  "embedding-models": {
    label: "Embedding Models",
    sortOptions: [
      { key: "similarity", label: "Cosine Similarity" },
      { key: "retrieval", label: "Retrieval Accuracy" },
      { key: "speed", label: "Inference Speed" },
    ],
  },
  experiments: {
    label: "Experiments",
    sortOptions: [
      { key: "overall", label: "Overall Score" },
      { key: "improvement", label: "Improvement %" },
      { key: "consistency", label: "Consistency" },
    ],
  },
};

const TIME_PERIODS: { key: TimePeriod; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
];

const TABS: { key: LeaderboardType; label: string }[] = [
  { key: "prompt-versions", label: "Prompt Versions" },
  { key: "models", label: "Models" },
  { key: "retrievers", label: "Retrievers" },
  { key: "chunkers", label: "Chunkers" },
  { key: "embedding-models", label: "Embedding Models" },
  { key: "experiments", label: "Experiments" },
];

// Mock Data
const MOCK_DATA: Record<LeaderboardType, LeaderboardEntry[]> = {
  "prompt-versions": [
    { rank: 1, name: "v2.4.1-enhanced", score: 94.2, metrics: [{ label: "Accuracy", value: "96.1%", variant: "success" }, { label: "Relevance", value: "92.3%", variant: "success" }], trend: "up", trendValue: "+2.1%" },
    { rank: 2, name: "v2.4.0-context", score: 91.8, metrics: [{ label: "Accuracy", value: "93.5%", variant: "success" }, { label: "Relevance", value: "90.1%", variant: "info" }], trend: "stable", trendValue: "0.0%" },
    { rank: 3, name: "v2.3.9-reasoning", score: 89.5, metrics: [{ label: "Accuracy", value: "91.2%", variant: "info" }, { label: "Relevance", value: "87.8%", variant: "info" }], trend: "down", trendValue: "-1.3%" },
    { rank: 4, name: "v2.3.8-baseline", score: 87.1, metrics: [{ label: "Accuracy", value: "88.9%", variant: "info" }, { label: "Relevance", value: "85.3%", variant: "warning" }], trend: "up", trendValue: "+0.8%" },
    { rank: 5, name: "v2.3.7-chain", score: 85.4, metrics: [{ label: "Accuracy", value: "86.7%", variant: "info" }, { label: "Relevance", value: "84.1%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 6, name: "v2.3.6-few-shot", score: 83.9, metrics: [{ label: "Accuracy", value: "85.2%", variant: "warning" }, { label: "Relevance", value: "82.6%", variant: "warning" }], trend: "up", trendValue: "+1.5%" },
    { rank: 7, name: "v2.3.5-zero", score: 81.2, metrics: [{ label: "Accuracy", value: "82.8%", variant: "warning" }, { label: "Relevance", value: "79.6%", variant: "warning" }], trend: "down", trendValue: "-0.7%" },
    { rank: 8, name: "v2.3.4-simple", score: 79.6, metrics: [{ label: "Accuracy", value: "80.4%", variant: "warning" }, { label: "Relevance", value: "78.8%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 9, name: "v2.3.3-direct", score: 77.3, metrics: [{ label: "Accuracy", value: "78.1%", variant: "warning" }, { label: "Relevance", value: "76.5%", variant: "warning" }], trend: "up", trendValue: "+0.3%" },
    { rank: 10, name: "v2.3.2-basic", score: 74.8, metrics: [{ label: "Accuracy", value: "75.6%", variant: "warning" }, { label: "Relevance", value: "74.0%", variant: "warning" }], trend: "down", trendValue: "-2.1%" },
    { rank: 11, name: "v2.3.1-v1", score: 72.1, metrics: [{ label: "Accuracy", value: "73.2%", variant: "warning" }, { label: "Relevance", value: "71.0%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 12, name: "v2.3.0-alpha", score: 69.5, metrics: [{ label: "Accuracy", value: "70.8%", variant: "warning" }, { label: "Relevance", value: "68.2%", variant: "warning" }], trend: "up", trendValue: "+0.5%" },
  ],
  models: [
    { rank: 1, name: "GPT-4o", score: 96.3, metrics: [{ label: "Quality", value: "97.1%", variant: "success" }, { label: "Latency", value: "1.2s", variant: "info" }], trend: "up", trendValue: "+1.2%" },
    { rank: 2, name: "Claude 3.5 Sonnet", score: 94.8, metrics: [{ label: "Quality", value: "95.6%", variant: "success" }, { label: "Latency", value: "1.4s", variant: "info" }], trend: "stable", trendValue: "0.0%" },
    { rank: 3, name: "Gemini 1.5 Pro", score: 92.1, metrics: [{ label: "Quality", value: "93.2%", variant: "success" }, { label: "Latency", value: "1.1s", variant: "info" }], trend: "up", trendValue: "+2.3%" },
    { rank: 4, name: "GPT-4 Turbo", score: 90.5, metrics: [{ label: "Quality", value: "91.8%", variant: "info" }, { label: "Latency", value: "1.6s", variant: "warning" }], trend: "down", trendValue: "-0.8%" },
    { rank: 5, name: "Llama 3.1 70B", score: 87.9, metrics: [{ label: "Quality", value: "88.4%", variant: "info" }, { label: "Latency", value: "2.1s", variant: "warning" }], trend: "up", trendValue: "+3.1%" },
    { rank: 6, name: "Mistral Large", score: 86.2, metrics: [{ label: "Quality", value: "87.1%", variant: "info" }, { label: "Latency", value: "1.8s", variant: "info" }], trend: "stable", trendValue: "0.0%" },
    { rank: 7, name: "Claude 3 Haiku", score: 84.7, metrics: [{ label: "Quality", value: "85.3%", variant: "warning" }, { label: "Latency", value: "0.8s", variant: "success" }], trend: "up", trendValue: "+1.5%" },
    { rank: 8, name: "GPT-3.5 Turbo", score: 82.3, metrics: [{ label: "Quality", value: "83.1%", variant: "warning" }, { label: "Latency", value: "0.6s", variant: "success" }], trend: "down", trendValue: "-1.2%" },
    { rank: 9, name: "Llama 3.1 8B", score: 79.8, metrics: [{ label: "Quality", value: "80.4%", variant: "warning" }, { label: "Latency", value: "0.9s", variant: "success" }], trend: "up", trendValue: "+2.8%" },
    { rank: 10, name: "Mistral 7B", score: 77.1, metrics: [{ label: "Quality", value: "77.9%", variant: "warning" }, { label: "Latency", value: "0.7s", variant: "success" }], trend: "stable", trendValue: "0.0%" },
    { rank: 11, name: "Phi-3 Medium", score: 74.6, metrics: [{ label: "Quality", value: "75.2%", variant: "warning" }, { label: "Latency", value: "1.0s", variant: "info" }], trend: "up", trendValue: "+0.9%" },
    { rank: 12, name: "Gemma 2 9B", score: 72.3, metrics: [{ label: "Quality", value: "73.1%", variant: "warning" }, { label: "Latency", value: "0.8s", variant: "success" }], trend: "down", trendValue: "-0.4%" },
  ],
  retrievers: [
    { rank: 1, name: "Hybrid RRF v2", score: 93.7, metrics: [{ label: "Recall@10", value: "95.2%", variant: "success" }, { label: "MRR", value: "0.89", variant: "success" }], trend: "up", trendValue: "+1.8%" },
    { rank: 2, name: "Dense + Rerank", score: 91.4, metrics: [{ label: "Recall@10", value: "93.1%", variant: "success" }, { label: "MRR", value: "0.86", variant: "success" }], trend: "stable", trendValue: "0.0%" },
    { rank: 3, name: "BM25 + Dense", score: 89.2, metrics: [{ label: "Recall@10", value: "91.4%", variant: "info" }, { label: "MRR", value: "0.83", variant: "info" }], trend: "up", trendValue: "+2.4%" },
    { rank: 4, name: "Vector Search", score: 86.8, metrics: [{ label: "Recall@10", value: "88.7%", variant: "info" }, { label: "MRR", value: "0.79", variant: "info" }], trend: "down", trendValue: "-0.6%" },
    { rank: 5, name: "Sparse Only", score: 84.3, metrics: [{ label: "Recall@10", value: "85.9%", variant: "warning" }, { label: "MRR", value: "0.76", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 6, name: "ColBERT v2", score: 82.1, metrics: [{ label: "Recall@10", value: "83.5%", variant: "warning" }, { label: "MRR", value: "0.74", variant: "warning" }], trend: "up", trendValue: "+1.2%" },
    { rank: 7, name: "SPLADE v3", score: 80.5, metrics: [{ label: "Recall@10", value: "81.8%", variant: "warning" }, { label: "MRR", value: "0.72", variant: "warning" }], trend: "up", trendValue: "+0.9%" },
    { rank: 8, name: "BM25 Baseline", score: 78.2, metrics: [{ label: "Recall@10", value: "79.4%", variant: "warning" }, { label: "MRR", value: "0.69", variant: "warning" }], trend: "down", trendValue: "-1.1%" },
    { rank: 9, name: "TF-IDF", score: 75.6, metrics: [{ label: "Recall@10", value: "76.8%", variant: "warning" }, { label: "MRR", value: "0.65", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 10, name: "Naive Cosine", score: 72.9, metrics: [{ label: "Recall@10", value: "74.1%", variant: "warning" }, { label: "MRR", value: "0.62", variant: "warning" }], trend: "down", trendValue: "-0.7%" },
    { rank: 11, name: "Keyword Only", score: 70.3, metrics: [{ label: "Recall@10", value: "71.5%", variant: "warning" }, { label: "MRR", value: "0.58", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 12, name: "Random Baseline", score: 45.2, metrics: [{ label: "Recall@10", value: "46.8%", variant: "warning" }, { label: "MRR", value: "0.31", variant: "warning" }], trend: "down", trendValue: "-2.3%" },
  ],
  chunkers: [
    { rank: 1, name: "Semantic v3", score: 92.5, metrics: [{ label: "Coherence", value: "94.1%", variant: "success" }, { label: "Coverage", value: "90.9%", variant: "success" }], trend: "up", trendValue: "+1.7%" },
    { rank: 2, name: "Recursive 512", score: 90.1, metrics: [{ label: "Coherence", value: "91.3%", variant: "success" }, { label: "Coverage", value: "88.9%", variant: "info" }], trend: "stable", trendValue: "0.0%" },
    { rank: 3, name: "Agentic Chunker", score: 88.4, metrics: [{ label: "Coherence", value: "89.8%", variant: "info" }, { label: "Coverage", value: "87.0%", variant: "info" }], trend: "up", trendValue: "+2.9%" },
    { rank: 4, name: "Paragraph Split", score: 85.9, metrics: [{ label: "Coherence", value: "87.2%", variant: "info" }, { label: "Coverage", value: "84.6%", variant: "warning" }], trend: "down", trendValue: "-0.5%" },
    { rank: 5, name: "Markdown Aware", score: 83.7, metrics: [{ label: "Coherence", value: "85.1%", variant: "warning" }, { label: "Coverage", value: "82.3%", variant: "warning" }], trend: "up", trendValue: "+1.3%" },
    { rank: 6, name: "Sentence Window", score: 81.2, metrics: [{ label: "Coherence", value: "82.6%", variant: "warning" }, { label: "Coverage", value: "79.8%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 7, name: "Fixed 256", score: 78.6, metrics: [{ label: "Coherence", value: "79.4%", variant: "warning" }, { label: "Coverage", value: "77.8%", variant: "warning" }], trend: "down", trendValue: "-1.8%" },
    { rank: 8, name: "Sliding Window", score: 76.3, metrics: [{ label: "Coherence", value: "77.1%", variant: "warning" }, { label: "Coverage", value: "75.5%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 9, name: "Character Split", score: 73.8, metrics: [{ label: "Coherence", value: "74.6%", variant: "warning" }, { label: "Coverage", value: "73.0%", variant: "warning" }], trend: "up", trendValue: "+0.6%" },
    { rank: 10, name: "Fixed 128", score: 71.2, metrics: [{ label: "Coherence", value: "72.1%", variant: "warning" }, { label: "Coverage", value: "70.3%", variant: "warning" }], trend: "down", trendValue: "-0.9%" },
    { rank: 11, name: "Token Split", score: 68.9, metrics: [{ label: "Coherence", value: "69.7%", variant: "warning" }, { label: "Coverage", value: "68.1%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 12, name: "Naive Split", score: 65.4, metrics: [{ label: "Coherence", value: "66.2%", variant: "warning" }, { label: "Coverage", value: "64.6%", variant: "warning" }], trend: "down", trendValue: "-1.4%" },
  ],
  "embedding-models": [
    { rank: 1, name: "text-embedding-3-large", score: 95.1, metrics: [{ label: "Similarity", value: "0.96", variant: "success" }, { label: "Retrieval", value: "94.2%", variant: "success" }], trend: "up", trendValue: "+0.8%" },
    { rank: 2, name: "voyage-3", score: 93.4, metrics: [{ label: "Similarity", value: "0.94", variant: "success" }, { label: "Retrieval", value: "92.5%", variant: "success" }], trend: "stable", trendValue: "0.0%" },
    { rank: 3, name: "embed-v3", score: 91.8, metrics: [{ label: "Similarity", value: "0.92", variant: "success" }, { label: "Retrieval", value: "91.0%", variant: "info" }], trend: "up", trendValue: "+1.5%" },
    { rank: 4, name: "text-embedding-3-small", score: 89.6, metrics: [{ label: "Similarity", value: "0.90", variant: "info" }, { label: "Retrieval", value: "88.8%", variant: "info" }], trend: "down", trendValue: "-0.3%" },
    { rank: 5, name: "bge-large-en", score: 87.3, metrics: [{ label: "Similarity", value: "0.88", variant: "info" }, { label: "Retrieval", value: "86.5%", variant: "info" }], trend: "up", trendValue: "+2.1%" },
    { rank: 6, name: "e5-large-v2", score: 85.1, metrics: [{ label: "Similarity", value: "0.86", variant: "warning" }, { label: "Retrieval", value: "84.3%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 7, name: "gte-large", score: 83.4, metrics: [{ label: "Similarity", value: "0.84", variant: "warning" }, { label: "Retrieval", value: "82.6%", variant: "warning" }], trend: "up", trendValue: "+1.0%" },
    { rank: 8, name: "bge-base-en", score: 81.2, metrics: [{ label: "Similarity", value: "0.82", variant: "warning" }, { label: "Retrieval", value: "80.4%", variant: "warning" }], trend: "down", trendValue: "-0.6%" },
    { rank: 9, name: "e5-base-v2", score: 79.5, metrics: [{ label: "Similarity", value: "0.80", variant: "warning" }, { label: "Retrieval", value: "78.7%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 10, name: "all-MiniLM-L6", score: 76.8, metrics: [{ label: "Similarity", value: "0.77", variant: "warning" }, { label: "Retrieval", value: "76.0%", variant: "warning" }], trend: "up", trendValue: "+0.4%" },
    { rank: 11, name: "bge-small-en", score: 74.3, metrics: [{ label: "Similarity", value: "0.75", variant: "warning" }, { label: "Retrieval", value: "73.5%", variant: "warning" }], trend: "down", trendValue: "-0.8%" },
    { rank: 12, name: "fastembed-base", score: 71.9, metrics: [{ label: "Similarity", value: "0.72", variant: "warning" }, { label: "Retrieval", value: "71.1%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
  ],
  experiments: [
    { rank: 1, name: "Exp-247 Full Pipeline", score: 97.2, metrics: [{ label: "Overall", value: "97.2%", variant: "success" }, { label: "Improvement", value: "+12.4%", variant: "success" }], trend: "up", trendValue: "+3.2%" },
    { rank: 2, name: "Exp-245 RAG Tuned", score: 94.8, metrics: [{ label: "Overall", value: "94.8%", variant: "success" }, { label: "Improvement", value: "+9.1%", variant: "success" }], trend: "stable", trendValue: "0.0%" },
    { rank: 3, name: "Exp-243 Hybrid Retriever", score: 92.3, metrics: [{ label: "Overall", value: "92.3%", variant: "success" }, { label: "Improvement", value: "+7.8%", variant: "info" }], trend: "up", trendValue: "+1.9%" },
    { rank: 4, name: "Exp-241 Prompt Chain", score: 90.1, metrics: [{ label: "Overall", value: "90.1%", variant: "info" }, { label: "Improvement", value: "+5.6%", variant: "info" }], trend: "down", trendValue: "-0.4%" },
    { rank: 5, name: "Exp-239 Context Expand", score: 88.5, metrics: [{ label: "Overall", value: "88.5%", variant: "info" }, { label: "Improvement", value: "+4.2%", variant: "info" }], trend: "up", trendValue: "+2.7%" },
    { rank: 6, name: "Exp-237 Semantic Chunk", score: 86.2, metrics: [{ label: "Overall", value: "86.2%", variant: "warning" }, { label: "Improvement", value: "+3.1%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 7, name: "Exp-235 Reranker v2", score: 84.7, metrics: [{ label: "Overall", value: "84.7%", variant: "warning" }, { label: "Improvement", value: "+2.4%", variant: "warning" }], trend: "up", trendValue: "+1.1%" },
    { rank: 8, name: "Exp-233 Few-Shot", score: 82.3, metrics: [{ label: "Overall", value: "82.3%", variant: "warning" }, { label: "Improvement", value: "+1.8%", variant: "warning" }], trend: "down", trendValue: "-0.9%" },
    { rank: 9, name: "Exp-231 Dense Search", score: 80.1, metrics: [{ label: "Overall", value: "80.1%", variant: "warning" }, { label: "Improvement", value: "+1.2%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
    { rank: 10, name: "Exp-229 Baseline v3", score: 78.6, metrics: [{ label: "Overall", value: "78.6%", variant: "warning" }, { label: "Improvement", value: "+0.8%", variant: "warning" }], trend: "up", trendValue: "+0.5%" },
    { rank: 11, name: "Exp-227 Simple RAG", score: 76.2, metrics: [{ label: "Overall", value: "76.2%", variant: "warning" }, { label: "Improvement", value: "+0.4%", variant: "warning" }], trend: "down", trendValue: "-0.3%" },
    { rank: 12, name: "Exp-225 Control", score: 75.0, metrics: [{ label: "Overall", value: "75.0%", variant: "warning" }, { label: "Improvement", value: "+0.0%", variant: "warning" }], trend: "stable", trendValue: "0.0%" },
  ],
};

// Helper functions
function getTrendIcon(trend: Trend) {
  switch (trend) {
    case "up":
      return <TrendingUp size={14} className="text-success" />;
    case "down":
      return <TrendingDown size={14} className="text-error" />;
    case "stable":
      return <Minus size={14} className="text-text-tertiary" />;
  }
}

function getTrendColor(trend: Trend) {
  switch (trend) {
    case "up":
      return "text-success";
    case "down":
      return "text-error";
    case "stable":
      return "text-text-tertiary";
  }
}

function getTierBadge(rank: number) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-bold uppercase tracking-wider">
        <Trophy size={10} />
        Gold
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-300/10 text-gray-300 text-[10px] font-bold uppercase tracking-wider">
        <Medal size={10} />
        Silver
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-600/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider">
        <Award size={10} />
        Bronze
      </span>
    );
  }
  return null;
}

function getScoreColor(score: number) {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-info";
  if (score >= 70) return "bg-warning";
  return "bg-error";
}

function getMetricBadgeVariant(variant: LeaderboardEntry["metrics"][0]["variant"]) {
  switch (variant) {
    case "success":
      return "bg-success/10 text-success border-success/20";
    case "info":
      return "bg-info/10 text-info border-info/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/20";
    case "default":
      return "bg-surface text-text-secondary border-border";
  }
}

// Sub-components
function TabSelector({
  activeTab,
  onTabChange,
}: {
  activeTab: LeaderboardType;
  onTabChange: (tab: LeaderboardType) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-surface-hover rounded-lg overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-md transition-all whitespace-nowrap",
            activeTab === tab.key
              ? "bg-surface text-text-primary shadow-sm"
              : "text-text-tertiary hover:text-text-secondary"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function FilterControls({
  timePeriod,
  onTimePeriodChange,
  sortBy,
  onSortChange,
  sortOptions,
}: {
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  sortOptions: { key: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-text-tertiary" />
        <div className="flex items-center gap-1 p-0.5 bg-surface-hover rounded-md">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.key}
              onClick={() => onTimePeriodChange(period.key)}
              className={cn(
                "px-2.5 py-1 text-[12px] font-medium rounded transition-all",
                timePeriod === period.key
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown size={14} className="text-text-tertiary" />
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none bg-surface-hover border border-border rounded-md px-3 py-1.5 pr-8 text-[13px] font-medium text-text-secondary cursor-pointer hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          >
            {sortOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  maxScore,
  showTier,
}: {
  entry: LeaderboardEntry;
  maxScore: number;
  showTier: boolean;
}) {
  const scorePercentage = (entry.score / maxScore) * 100;

  return (
    <div className="group flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
      {/* Rank */}
      <div className="w-12 flex-shrink-0">
        <span className="text-sm font-bold text-text-primary tabular-nums">
          #{entry.rank}
        </span>
      </div>

      {/* Tier Badge */}
      {showTier && (
        <div className="w-20 flex-shrink-0">
          {getTierBadge(entry.rank)}
        </div>
      )}

      {/* Name & Score */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary truncate">
            {entry.name}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden max-w-[200px]">
            <div
              className={cn("h-full rounded-full transition-all duration-500", getScoreColor(entry.score))}
              style={{ width: `${scorePercentage}%` }}
            />
          </div>
          <span className="text-sm font-bold text-text-primary tabular-nums">
            {entry.score.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-2">
        {entry.metrics.map((metric, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border",
              getMetricBadgeVariant(metric.variant)
            )}
          >
            {metric.label}: {metric.value}
          </span>
        ))}
      </div>

      {/* Trend */}
      <div className={cn("flex items-center gap-1 text-[12px] font-medium min-w-[70px] justify-end", getTrendColor(entry.trend))}>
        {getTrendIcon(entry.trend)}
        <span>{entry.trendValue}</span>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-[12px] text-text-tertiary">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={14} />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? "primary" : "ghost"}
            size="sm"
            onClick={() => onPageChange(page)}
            className="min-w-[32px]"
          >
            {page}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

// Main Component
export function Leaderboards() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>("prompt-versions");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("30d");
  const [sortBy, setSortBy] = useState("composite");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const config = LEADERBOARD_CONFIGS[activeTab];
  const data = MOCK_DATA[activeTab];

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === config.sortOptions[0]?.key) {
        return b.score - a.score;
      }
      return b.score - a.score;
    });
  }, [data, sortBy, config]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const maxScore = Math.max(...sortedData.map((e) => e.score));

  const handleTabChange = (tab: LeaderboardType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSortBy(LEADERBOARD_CONFIGS[tab].sortOptions[0].key);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand/10">
            <BarChart3 size={20} className="text-brand" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Leaderboards</h2>
            <p className="text-[13px] text-text-tertiary">Rankings across evaluation dimensions</p>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <TabSelector activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Filter Controls */}
      <FilterControls
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={config.sortOptions}
      />

      {/* Leaderboard Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-4 px-4 py-2.5 bg-surface-hover border-b border-border">
          <div className="w-12 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            Rank
          </div>
          <div className="w-20 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            Tier
          </div>
          <div className="flex-1 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            Name / Score
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            Metrics
          </div>
          <div className="w-[70px] text-right text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            Trend
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border/50">
          {paginatedData.map((entry) => (
            <LeaderboardRow
              key={entry.rank}
              entry={entry}
              maxScore={maxScore}
              showTier={true}
            />
          ))}
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
