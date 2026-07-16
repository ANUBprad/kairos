"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  FileCode2,
  Layers,
  Search,
  ArrowUpDown,
  Brain,
  Gavel,
  BarChart3,
  Play,
  RotateCcw,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDatasetsForSelector } from "@/lib/actions/evaluation";
import { logger } from "@/lib/logger";

interface PipelineStage {
  id: string;
  name: string;
  icon: typeof Database;
  color: string;
  options: { id: string; label: string; description: string }[];
  selected: string | null;
  loading?: boolean;
}

export function ExperimentBuilderClient() {
  const [stages, setStages] = useState<PipelineStage[]>([
    {
      id: "dataset",
      name: "Dataset",
      icon: Database,
      color: "text-info",
      options: [],
      selected: null,
      loading: true,
    },
    {
      id: "chunking",
      name: "Chunking",
      icon: FileCode2,
      color: "text-brand",
      options: [
        { id: "recursive", label: "Recursive", description: "512 tokens, 50 overlap" },
        { id: "sentence", label: "Sentence", description: "Per-sentence splitting" },
        { id: "semantic", label: "Semantic", description: "Meaning-based boundaries" },
        { id: "markdown", label: "Markdown-aware", description: "Section-aware splitting" },
      ],
      selected: "recursive",
    },
    {
      id: "embedding",
      name: "Embedding",
      icon: Layers,
      color: "text-success",
      options: [
        { id: "large", label: "text-embedding-3-large", description: "3072 dimensions" },
        { id: "small", label: "text-embedding-3-small", description: "1536 dimensions" },
        { id: "local", label: "Local Embedder", description: "all-MiniLM-L6-v2" },
      ],
      selected: "large",
    },
    {
      id: "retriever",
      name: "Retriever",
      icon: Search,
      color: "text-warning",
      options: [
        { id: "vector", label: "Vector Search", description: "Pure cosine similarity" },
        { id: "bm25", label: "BM25", description: "Keyword-based retrieval" },
        { id: "hybrid-rrf", label: "Hybrid RRF", description: "Reciprocal rank fusion" },
        { id: "multi-query", label: "Multi-Query", description: "Query expansion" },
      ],
      selected: "hybrid-rrf",
    },
    {
      id: "reranker",
      name: "Reranker",
      icon: ArrowUpDown,
      color: "text-info",
      options: [
        { id: "none", label: "None", description: "No reranking" },
        { id: "cross-encoder", label: "Cross-Encoder", description: "ms-marco-MiniLM-L-6-v2" },
      ],
      selected: "cross-encoder",
    },
    {
      id: "llm",
      name: "LLM",
      icon: Brain,
      color: "text-brand",
      options: [
        { id: "gpt-4o", label: "GPT-4o", description: "Best quality, higher cost" },
        { id: "gpt-4o-mini", label: "GPT-4o Mini", description: "Faster, lower cost" },
        { id: "claude", label: "Claude 3.5 Sonnet", description: "Anthropic" },
      ],
      selected: "gpt-4o",
    },
    {
      id: "judge",
      name: "Judge",
      icon: Gavel,
      color: "text-success",
      options: [
        { id: "llm", label: "LLM Judge", description: "AI-based evaluation" },
        { id: "faithfulness", label: "Faithfulness", description: "Citation-grounded" },
      ],
      selected: "llm",
    },
    {
      id: "metrics",
      name: "Metrics",
      icon: BarChart3,
      color: "text-warning",
      options: [
        { id: "standard", label: "Standard Set", description: "Recall, MRR, nDCG, Precision" },
        { id: "full", label: "Full Suite", description: "All 12+ metrics" },
        { id: "custom", label: "Custom", description: "Select specific metrics" },
      ],
      selected: "standard",
    },
  ]);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    async function fetchDynamicOptions() {
      try {
        const datasets = await getDatasetsForSelector();

        const datasetOptions = datasets.map((d) => ({
          id: d.id,
          label: d.name,
          description: `${d._count.questions} questions`,
        }));

        setStages((prev) =>
          prev.map((stage) => {
            if (stage.id === "dataset") {
              return {
                ...stage,
                options: datasetOptions.length > 0 ? datasetOptions : [
                  { id: "custom", label: "Custom Dataset", description: "Upload your own" },
                ],
                selected: datasetOptions.length > 0 ? datasetOptions[0].id : null,
                loading: false,
              };
            }
            return stage;
          })
        );
      } catch (error) {
        logger.error("Failed to fetch dynamic options", { error: error instanceof Error ? error.message : String(error) });
        setStages((prev) =>
          prev.map((stage) => {
            if (stage.id === "dataset") {
              return {
                ...stage,
                options: [
                  { id: "custom", label: "Custom Dataset", description: "Upload your own" },
                ],
                selected: null,
                loading: false,
              };
            }
            return stage;
          })
        );
      }
    }
    fetchDynamicOptions();
  }, []);

  function selectOption(stageId: string, optionId: string) {
    setStages(stages.map((s) => (s.id === stageId ? { ...s, selected: optionId } : s)));
  }

  function resetPipeline() {
    setStages((prev) =>
      prev.map((stage) => ({
        ...stage,
        selected: stage.id === "dataset" ? (stage.options.length > 0 ? stage.options[0].id : null) : stage.options[0]?.id || null,
      }))
    );
    setExpandedStage(null);
  }

  function runExperiment() {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 3000);
  }

  const completedCount = stages.filter((s) => s.selected).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Experiment Builder"
        description="Visually assemble your RAG experiment pipeline by selecting configuration for each stage."
        purpose="Build reproducible experiments by chaining pipeline stages together in a visual workflow."
        nextAction={{ label: "View Results", href: "/app/evaluation" }}
        relatedPages={[
          { label: "Retrieval Lab", href: "/app/retrieval-lab" },
          { label: "Experiment Lineage", href: "/app/lineage" },
        ]}
      />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse-ring" />
            <span className="text-xs text-text-secondary">
              {completedCount}/{stages.length} stages configured
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetPipeline}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={runExperiment}
            disabled={isRunning}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors",
              isRunning
                ? "bg-brand/20 text-brand cursor-wait"
                : "bg-brand text-white hover:bg-brand-hover"
            )}
          >
            <Play size={14} className={isRunning ? "animate-spin" : ""} />
            {isRunning ? "Running..." : "Run Experiment"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((stage, i) => {
          const Icon = stage.icon;
          const isExpanded = expandedStage === stage.id;
          const selectedOption = stage.options.find((o) => o.id === stage.selected);
          return (
            <div key={stage.id} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-colors",
                    stage.selected
                      ? "border-brand bg-brand/10"
                      : "border-border bg-surface"
                  )}
                >
                  {stage.loading ? (
                    <Skeleton className="h-5 w-5 rounded" />
                  ) : (
                    <Icon
                      size={18}
                      className={stage.selected ? stage.color : "text-text-tertiary"}
                    />
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div className="flex-1 w-px bg-border my-1 hidden sm:block" />
                )}
              </div>

              <PremiumCard
                variant="elevated"
                className="flex-1 cursor-pointer"
                onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        {stage.name}
                      </h3>
                      {stage.loading ? (
                        <Skeleton className="h-4 w-32 mt-1" />
                      ) : selectedOption && !isExpanded ? (
                        <p className="text-xs text-text-secondary">
                          {selectedOption.label} — {selectedOption.description}
                        </p>
                      ) : (
                        <p className="text-xs text-text-tertiary">
                          Select an option
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stage.selected && (
                      <Check size={14} className="text-success" />
                    )}
                    <ChevronRight
                      size={16}
                      className={cn(
                        "text-text-tertiary transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4 animate-scale-in">
                    {stage.loading ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[1, 2, 3].map((n) => (
                          <Skeleton key={n} className="h-20" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {stage.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectOption(stage.id, opt.id);
                            }}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                              stage.selected === opt.id
                                ? "border-brand bg-brand/5"
                                : "border-border hover:border-border-hover hover:bg-surface-hover"
                            )}
                          >
                            <div
                              className={cn(
                                "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center",
                                stage.selected === opt.id
                                  ? "border-brand"
                                  : "border-border"
                              )}
                            >
                              {stage.selected === opt.id && (
                                <div className="h-2 w-2 rounded-full bg-brand" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-text-primary">
                                {opt.label}
                              </p>
                              <p className="text-xs text-text-tertiary">
                                {opt.description}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </PremiumCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}
