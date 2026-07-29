"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Play,
  Check,
  Trophy,
  Clock,
  DollarSign,
  Hash,
  Brain,
  Shield,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  color: string;
  baseLatency: number;
  costPer1kTokens: number;
  qualityProfile: {
    answerQuality: [number, number];
    groundedness: [number, number];
    hallucination: [number, number];
    faithfulness: [number, number];
  };
}

const MODELS: ModelConfig[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    color: "#10A37F",
    baseLatency: 1200,
    costPer1kTokens: 0.01,
    qualityProfile: {
      answerQuality: [0.88, 0.95],
      groundedness: [0.85, 0.93],
      hallucination: [0.05, 0.12],
      faithfulness: [0.87, 0.94],
    },
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    color: "#10A37F",
    baseLatency: 600,
    costPer1kTokens: 0.00015,
    qualityProfile: {
      answerQuality: [0.78, 0.86],
      groundedness: [0.75, 0.84],
      hallucination: [0.10, 0.18],
      faithfulness: [0.76, 0.85],
    },
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "Anthropic",
    color: "#D97757",
    baseLatency: 1800,
    costPer1kTokens: 0.015,
    qualityProfile: {
      answerQuality: [0.90, 0.96],
      groundedness: [0.88, 0.95],
      hallucination: [0.04, 0.10],
      faithfulness: [0.89, 0.96],
    },
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    color: "#D97757",
    baseLatency: 450,
    costPer1kTokens: 0.00025,
    qualityProfile: {
      answerQuality: [0.74, 0.82],
      groundedness: [0.72, 0.80],
      hallucination: [0.12, 0.20],
      faithfulness: [0.73, 0.81],
    },
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "Google",
    color: "#4285F4",
    baseLatency: 900,
    costPer1kTokens: 0.0005,
    qualityProfile: {
      answerQuality: [0.82, 0.90],
      groundedness: [0.80, 0.88],
      hallucination: [0.08, 0.15],
      faithfulness: [0.81, 0.89],
    },
  },
  {
    id: "gemini-flash",
    name: "Gemini Flash",
    provider: "Google",
    color: "#4285F4",
    baseLatency: 350,
    costPer1kTokens: 0.000075,
    qualityProfile: {
      answerQuality: [0.70, 0.78],
      groundedness: [0.68, 0.76],
      hallucination: [0.14, 0.22],
      faithfulness: [0.69, 0.77],
    },
  },
  {
    id: "local-llama",
    name: "Local LLaMA 3",
    provider: "Self-hosted",
    color: "#8B5CF6",
    baseLatency: 2200,
    costPer1kTokens: 0,
    qualityProfile: {
      answerQuality: [0.62, 0.74],
      groundedness: [0.60, 0.72],
      hallucination: [0.18, 0.28],
      faithfulness: [0.61, 0.73],
    },
  },
];

interface ComparisonResult {
  modelId: string;
  latencyMs: number;
  cost: number;
  tokens: number;
  answerQuality: number;
  groundedness: number;
  hallucination: number;
  faithfulness: number;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateMockResult(model: ModelConfig): ComparisonResult {
  const latencyVariance = randomInRange(0.7, 1.3);
  const tokenCount = Math.round(randomInRange(800, 2400));

  return {
    modelId: model.id,
    latencyMs: Math.round(model.baseLatency * latencyVariance),
    cost: model.costPer1kTokens * (tokenCount / 1000),
    tokens: tokenCount,
    answerQuality: randomInRange(...model.qualityProfile.answerQuality),
    groundedness: randomInRange(...model.qualityProfile.groundedness),
    hallucination: randomInRange(...model.qualityProfile.hallucination),
    faithfulness: randomInRange(...model.qualityProfile.faithfulness),
  };
}

function getCellColor(
  value: number,
  higherIsBetter: boolean,
  allValues: number[]
): string {
  const sorted = [...allValues].sort((a, b) => (higherIsBetter ? b - a : a - b));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (value === best) return "bg-success/15 text-success";
  if (value === worst) return "bg-error/15 text-error";
  if (sorted.length > 2) {
    const mid = sorted[Math.floor(sorted.length / 2)];
    if (value === mid) return "bg-surface-hover text-text-primary";
  }
  return "bg-surface text-text-primary";
}

function getWinRate(
  results: ComparisonResult[],
  key: keyof ComparisonResult
): Record<string, number> {
  if (results.length === 0) return {};

  const higherIsBetter = key !== "latencyMs" && key !== "cost" && key !== "hallucination" && key !== "tokens";
  const sorted = [...results].sort((a, b) => {
    const va = a[key] as number;
    const vb = b[key] as number;
    return higherIsBetter ? vb - va : va - vb;
  });

  const wins: Record<string, number> = {};
  results.forEach((r) => (wins[r.modelId] = 0));

  sorted.forEach((r, i) => {
    if (i === 0) wins[r.modelId] += 3;
    else if (i === 1) wins[r.modelId] += 2;
    else if (i === 2) wins[r.modelId] += 1;
  });

  const maxPossible = results.length * 3;
  const rates: Record<string, number> = {};
  Object.keys(wins).forEach((id) => {
    rates[id] = Math.round((wins[id] / maxPossible) * 100);
  });
  return rates;
}

function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "Free";
  if (cost < 0.001) return `$${(cost * 1000).toFixed(2)}k`;
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString();
}

function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

const METRIC_DEFS: {
  key: keyof ComparisonResult;
  label: string;
  icon: typeof Clock;
  higherIsBetter: boolean;
  format: (v: number) => string;
}[] = [
  { key: "latencyMs", label: "Latency", icon: Clock, higherIsBetter: false, format: formatLatency },
  { key: "cost", label: "Cost", icon: DollarSign, higherIsBetter: false, format: formatCost },
  { key: "tokens", label: "Tokens", icon: Hash, higherIsBetter: false, format: formatTokens },
  { key: "answerQuality", label: "Answer Quality", icon: Brain, higherIsBetter: true, format: formatScore },
  { key: "groundedness", label: "Groundedness", icon: Shield, higherIsBetter: true, format: formatScore },
  { key: "hallucination", label: "Hallucination", icon: AlertTriangle, higherIsBetter: false, format: formatScore },
  { key: "faithfulness", label: "Faithfulness", icon: Sparkles, higherIsBetter: true, format: formatScore },
];

interface ModelComparisonProps {
  className?: string;
}

export function ModelComparison({ className }: ModelComparisonProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>(["gpt-4o", "claude-3-opus"]);
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId);
      }
      if (prev.length >= 4) return prev;
      return [...prev, modelId];
    });
  }, []);

  const runComparison = useCallback(() => {
    if (selectedModels.length < 2 || !prompt.trim()) return;

    setIsRunning(true);
    setResults([]);

    const selected = MODELS.filter((m) => selectedModels.includes(m.id));
    const mockResults = selected.map(generateMockResult);

    setTimeout(() => {
      setResults(mockResults);
      setIsRunning(false);
    }, 1500);
  }, [selectedModels, prompt]);

  const resetComparison = useCallback(() => {
    setResults([]);
    setExpandedRows(new Set());
  }, []);

  const toggleRow = useCallback((modelId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }, []);

  const winRates = useMemo(() => {
    if (results.length === 0) return {};
    const combined: Record<string, number> = {};
    results.forEach((r) => (combined[r.modelId] = 0));

    METRIC_DEFS.forEach(({ key }) => {
      const rates = getWinRate(results, key);
      Object.keys(rates).forEach((id) => {
        combined[id] = (combined[id] || 0) + rates[id];
      });
    });

    const avg = METRIC_DEFS.length;
    Object.keys(combined).forEach((id) => {
      combined[id] = Math.round(combined[id] / avg);
    });
    return combined;
  }, [results]);

  const overallWinner = useMemo(() => {
    if (Object.keys(winRates).length === 0) return null;
    return Object.entries(winRates).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  }, [winRates]);

  return (
    <div className={cn("space-y-6", className)}>
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Shared Prompt / Pregunta
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to compare across models..."
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-hover px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-text-primary">
                Select Models to Compare
              </label>
              <span className="text-xs text-text-tertiary">
                {selectedModels.length}/4 selected
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {MODELS.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={!isSelected && selectedModels.length >= 4}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                      isSelected
                        ? "border-brand bg-brand/5 text-text-primary"
                        : "border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover",
                      !isSelected && selectedModels.length >= 4 && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all",
                        isSelected ? "border-brand bg-brand" : "border-border"
                      )}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{model.name}</div>
                      <div className="text-[10px] text-text-tertiary">{model.provider}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={runComparison}
              disabled={selectedModels.length < 2 || !prompt.trim() || isRunning}
              size="md"
            >
              {isRunning ? (
                <>
                  <RotateCcw size={14} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run Comparison
                </>
              )}
            </Button>
            {results.length > 0 && (
              <Button onClick={resetComparison} variant="ghost" size="md">
                <RotateCcw size={14} />
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {results.length > 0 && (
        <>
          {overallWinner && (
            <div className="text-center">
              <Badge variant="brand" className="text-sm px-4 py-1.5">
                <Trophy size={14} className="mr-1.5" />
                {MODELS.find((m) => m.id === overallWinner)?.name} wins overall
                {winRates[overallWinner] !== undefined && (
                  <span className="ml-2 opacity-70">({winRates[overallWinner]}% win rate)</span>
                )}
              </Badge>
            </div>
          )}

          <Card className="p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Comparison Results
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" role="table">
                <caption className="sr-only">
                  Model comparison metrics for: {prompt}
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-text-tertiary font-medium" scope="col">
                      Metric
                    </th>
                    {results.map((r) => {
                      const model = MODELS.find((m) => m.id === r.modelId)!;
                      const isWin = r.modelId === overallWinner;
                      return (
                        <th key={r.modelId} className="text-right py-2 px-3 font-medium" scope="col">
                          <div className="flex items-center justify-end gap-1.5">
                            {isWin && <Trophy size={11} className="text-brand" />}
                            <span className="text-text-primary">{model.name}</span>
                          </div>
                          <div className="text-[10px] text-text-tertiary font-normal">{model.provider}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_DEFS.map(({ key, label, icon: Icon, higherIsBetter, format }) => {
                    const values = results.map((r) => r[key] as number);
                    return (
                      <tr key={key} className="border-b border-border/50 hover:bg-surface-hover/50">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Icon size={13} className="text-text-tertiary shrink-0" />
                            <span className="text-text-primary font-medium">{label}</span>
                          </div>
                        </td>
                        {results.map((r) => {
                          const val = r[key] as number;
                          const cellColor = getCellColor(val, higherIsBetter, values);
                          return (
                            <td key={r.modelId} className="py-2.5 px-3 text-right">
                              <span
                                className={cn(
                                  "inline-block rounded-[6px] px-2 py-0.5 font-mono tabular-nums text-[11px]",
                                  cellColor
                                )}
                              >
                                {format(val)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Trophy size={13} className="text-brand shrink-0" />
                        <span className="text-text-primary font-semibold">Win Rate</span>
                      </div>
                    </td>
                    {results.map((r) => {
                      const rate = winRates[r.modelId] ?? 0;
                      const isHighest = r.modelId === overallWinner;
                      return (
                        <td key={r.modelId} className="py-3 px-3 text-right">
                          <span
                            className={cn(
                              "inline-block rounded-[6px] px-2 py-0.5 font-mono tabular-nums text-[11px] font-semibold",
                              isHighest ? "bg-brand/15 text-brand" : "bg-surface-hover text-text-primary"
                            )}
                          >
                            {rate}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className="text-sm font-semibold text-text-primary mb-4">Score Breakdown</h4>
              <div className="space-y-4">
                {results.map((r) => {
                  const model = MODELS.find((m) => m.id === r.modelId)!;
                  const compositeScore =
                    (r.answerQuality + r.groundedness + (1 - r.hallucination) + r.faithfulness) / 4;
                  const isExpanded = expandedRows.has(r.modelId);
                  return (
                    <div key={r.modelId} className="space-y-2">
                      <button
                        onClick={() => toggleRow(r.modelId)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: model.color }}
                          />
                          <span className="text-xs font-medium text-text-primary">
                            {model.name}
                          </span>
                          <span className="text-[10px] text-text-tertiary">
                            ({formatScore(compositeScore)} composite)
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={12} className="text-text-tertiary" />
                        ) : (
                          <ChevronDown size={12} className="text-text-tertiary" />
                        )}
                      </button>
                      <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${compositeScore * 100}%`,
                            backgroundColor: model.color,
                          }}
                        />
                      </div>
                      {isExpanded && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-4">
                          {METRIC_DEFS.filter((m) => m.higherIsBetter !== undefined).map(
                            ({ key, label, format }) => (
                              <div key={key} className="flex items-center justify-between">
                                <span className="text-[10px] text-text-tertiary">{label}</span>
                                <span className="text-[10px] font-mono text-text-secondary">
                                  {format(r[key] as number)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h4 className="text-sm font-semibold text-text-primary mb-4">
                Latency vs Quality
              </h4>
              <div className="relative h-64">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 400 250"
                  className="overflow-visible"
                >
                  <line
                    x1="50"
                    y1="20"
                    x2="50"
                    y2="220"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    opacity="0.2"
                  />
                  <line
                    x1="50"
                    y1="220"
                    x2="380"
                    y2="220"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    opacity="0.2"
                  />
                  <text x="15" y="130" className="fill-text-tertiary text-[9px]" textAnchor="middle" transform="rotate(-90, 15, 130)">
                    Quality Score
                  </text>
                  <text x="215" y="245" className="fill-text-tertiary text-[9px]" textAnchor="middle">
                    Latency (ms)
                  </text>
                  {results.map((r) => {
                    const model = MODELS.find((m) => m.id === r.modelId)!;
                    const maxLatency = Math.max(...results.map((x) => x.latencyMs)) * 1.1;
                    const quality =
                      (r.answerQuality + r.groundedness + (1 - r.hallucination) + r.faithfulness) / 4;
                    const x = 50 + (r.latencyMs / maxLatency) * 330;
                    const y = 220 - quality * 200;
                    return (
                      <g key={r.modelId}>
                        <circle cx={x} cy={y} r={8} fill={model.color} fillOpacity={0.7} stroke={model.color} strokeWidth={1.5} />
                        <text x={x} y={y - 12} className="fill-text-secondary text-[9px]" textAnchor="middle">
                          {model.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </Card>
          </div>
        </>
      )}

      {results.length === 0 && !isRunning && (
        <Card className="p-12 text-center">
          <Brain size={40} className="mx-auto text-text-tertiary mb-3 opacity-50" />
          <p className="text-sm text-text-secondary">
            Select 2-4 models and enter a prompt to start comparing
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            Results include latency, cost, tokens, and quality scores
          </p>
        </Card>
      )}
    </div>
  );
}
