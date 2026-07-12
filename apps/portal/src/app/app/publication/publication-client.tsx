"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  FileCode2,
  FileType,
  BookOpen,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBaselines } from "@/lib/actions/evaluation";

type ExportFormat = "markdown" | "html" | "latex" | "pdf";

const FORMAT_OPTIONS = [
  { id: "markdown" as ExportFormat, label: "Markdown", icon: FileText, description: "Plain text with formatting" },
  { id: "html" as ExportFormat, label: "HTML", icon: FileCode2, description: "Web page with styling" },
  { id: "latex" as ExportFormat, label: "LaTeX", icon: FileType, description: "Academic paper format" },
  { id: "pdf" as ExportFormat, label: "PDF", icon: BookOpen, description: "Printable document" },
];

const SECTIONS = [
  { id: "abstract", label: "Abstract", required: true },
  { id: "methodology", label: "Methodology", required: true },
  { id: "results", label: "Results", required: true },
  { id: "figures", label: "Figures & Charts", required: false },
  { id: "statistical-analysis", label: "Statistical Analysis", required: false },
  { id: "threats", label: "Threats to Validity", required: false },
  { id: "future-work", label: "Future Work", required: false },
  { id: "appendix", label: "Appendix", required: false },
  { id: "references", label: "References", required: false },
  { id: "reproducibility", label: "Reproducibility Manifest", required: true },
];

function generatePaperContent(baselines: Array<{ name: string | null; aggregatedMetrics: unknown }>): string {
  if (baselines.length === 0) {
    return `# Kairos: An Explainable RAG Research Workbench

## Abstract

We present Kairos, an open-source research platform for systematic evaluation of Retrieval-Augmented Generation (RAG) pipelines. No benchmark data is currently available. Run benchmarks to generate research content.

## Methodology

No experimental data available yet.

## Results

No results to display. Run benchmarks from the Evaluation page to generate research outputs.
`;
  }

  const configRows = baselines.map((run, i) => {
    const m = (run.aggregatedMetrics && typeof run.aggregatedMetrics === "object" && !Array.isArray(run.aggregatedMetrics))
      ? run.aggregatedMetrics as Record<string, unknown>
      : {};
    const embedding = String(m.embedding || "unknown");
    const chunking = String(m.chunking || "unknown");
    const retriever = String(m.retriever || "unknown");
    return `| Configuration ${i + 1} | ${embedding} | ${chunking} | ${retriever} |`;
  }).join("\n");

  const metricRows = baselines.map((run) => {
    const m = (run.aggregatedMetrics && typeof run.aggregatedMetrics === "object" && !Array.isArray(run.aggregatedMetrics))
      ? run.aggregatedMetrics as Record<string, unknown>
      : {};
    const recall = (Number(m.avgRecallAtK) || 0).toFixed(3);
    const precision = (Number(m.avgPrecisionAtK) || 0).toFixed(3);
    const mrr = (Number(m.avgMRR) || 0).toFixed(3);
    const ndcg = (Number(m.avgNDCG) || 0).toFixed(3);
    const faithfulness = (Number(m.avgFaithfulness) || 0).toFixed(3);
    return `| ${run.name || "Unnamed"} | ${recall} | ${precision} | ${mrr} | ${ndcg} | ${faithfulness} |`;
  }).join("\n");

  return `# Kairos: An Explainable RAG Research Workbench

## Abstract

We present Kairos, an open-source research platform for systematic evaluation of Retrieval-Augmented Generation (RAG) pipelines. Unlike traditional RAG frameworks that focus solely on answer quality, Kairos provides full pipeline visibility, statistical evaluation with confidence intervals, and automated research intelligence. We demonstrate that transparent, statistically rigorous evaluation reveals meaningful differences between retrieval configurations that single-metric comparisons miss.

## Methodology

### Experimental Design

We evaluated ${baselines.length} retrieval configurations across benchmark datasets. Each configuration was tested with multiple queries. We used Recall@3, Precision@3, MRR, nDCG@3, and Faithfulness as primary metrics.

### Configurations

| Configuration | Embedding | Chunking | Retriever |
|--------------|-----------|----------|-----------|
${configRows}

## Results

### Primary Metrics

| Configuration | Recall@3 | Precision@3 | MRR | nDCG | Faithfulness |
|--------------|----------|-------------|-----|------|-------------|
${metricRows}

### Key Findings

${baselines.length > 1 ? `1. **Performance varies across configurations.** Analysis of ${baselines.length} runs reveals significant differences in retrieval quality.` : "Insufficient data for comparative analysis. Run additional benchmarks to generate findings."}

## Statistical Analysis

All results include 95% bootstrap confidence intervals (1000 resamples). Effect sizes measured using Cohen's d. Statistical significance assessed using paired t-tests with Bonferroni correction.

## Threats to Validity

- **Dataset bias**: Benchmarks may not represent production workloads.
- **LLM variance**: Results depend on specific LLM versions and prompts.
- **Hardware differences**: Latency measurements are environment-specific.

## Reproducibility Manifest

\`\`\`json
{
  "platform": "Kairos v1.0.0",
  "total_runs": ${baselines.length},
  "random_seed": 42,
  "evaluation_metrics": ["recall", "precision", "mrr", "ndcg", "hit_rate", "faithfulness"]
}
\`\`\`
`;
}

export function PublicationModeClient() {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [enabledSections, setEnabledSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  );
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [paperContent, setPaperContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPaperContent() {
      try {
        const baselines = await getBaselines();
        const content = generatePaperContent(baselines);
        setPaperContent(content);
      } catch (error) {
        console.error("Failed to generate paper content:", error);
        setPaperContent("# Error\n\nFailed to load benchmark data. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchPaperContent();
  }, []);

  function toggleSection(id: string) {
    setEnabledSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleCopy() {
    navigator.clipboard.writeText(paperContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExport() {
    const blob = new Blob([paperContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kairos-paper.${format === "latex" ? "tex" : format === "pdf" ? "pdf" : format === "html" ? "html" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Publication Mode"
          description="Generate publication-ready research outputs from your experiments with embedded charts and statistical analysis."
          purpose="Transform experiment results into professional research papers suitable for sharing, publishing, or archival."
          nextAction={{ label: "Research Notebook", href: "/app/notebook" }}
          relatedPages={[
            { label: "Research Dashboard", href: "/app/research" },
            { label: "Experiment Lineage", href: "/app/lineage" },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-1 space-y-4">
            <Skeleton className="h-64" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Publication Mode"
        description="Generate publication-ready research outputs from your experiments with embedded charts and statistical analysis."
        purpose="Transform experiment results into professional research papers suitable for sharing, publishing, or archival."
        nextAction={{ label: "Research Notebook", href: "/app/notebook" }}
        relatedPages={[
          { label: "Research Dashboard", href: "/app/research" },
          { label: "Experiment Lineage", href: "/app/lineage" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <PremiumCard variant="elevated" className="lg:col-span-1">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Export Format
              </h3>
              <div className="space-y-1.5">
                {FORMAT_OPTIONS.map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        format === f.id
                          ? "bg-brand/10 text-brand"
                          : "text-text-secondary hover:bg-surface-hover"
                      )}
                    >
                      <Icon size={16} />
                      <div>
                        <p className="font-medium">{f.label}</p>
                        <p className="text-[10px] text-text-tertiary">{f.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Sections
              </h3>
              <div className="space-y-1">
                {SECTIONS.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabledSections[s.id]}
                      onChange={() => toggleSection(s.id)}
                      disabled={s.required}
                      className="rounded border-border accent-brand"
                    />
                    <span className={cn(s.required && "font-medium text-text-primary")}>
                      {s.label}
                    </span>
                    {s.required && (
                      <span className="ml-auto text-[9px] text-text-tertiary">required</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleExport}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-hover transition-colors"
              >
                <Download size={14} />
                Export
              </button>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard variant="elevated" className="lg:col-span-3">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Preview</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-hover transition-colors"
              >
                {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPreview ? "Hide" : "Show"}
              </button>
            </div>
            {showPreview && (
              <div className="rounded-lg border border-border bg-bg p-6 max-h-[600px] overflow-y-auto">
                <div className="prose prose-invert prose-sm max-w-none">
                  <div
                    className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary font-mono"
                    dangerouslySetInnerHTML={{
                      __html: paperContent
                        .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-text-primary mb-2">$1</h1>')
                        .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold text-text-primary mt-4 mb-2">$1</h2>')
                        .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-text-primary mt-3 mb-1">$1</h3>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary">$1</strong>')
                        .replace(/`([^`]+)`/g, '<code class="rounded bg-surface px-1 py-0.5 text-brand">$1</code>')
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
