"use client";

import { useState, useMemo } from "react";
import {
  GitBranch, Download, FileText, ChevronDown, ChevronRight,
  Database, Cpu, Search, MessageSquare, BarChart3, CheckCircle2,
  ArrowRight, Copy, Check, AlertTriangle,
} from "lucide-react";
import {
  generateManifest,
  manifestToJSON,
  manifestToYAML,
  buildLineageGraph,
  buildProvenanceChain,
  computeReproducibilityScore,
  generateCitations,
  computeConfigurationDiff,
  diffToMarkdown,
  reproducibilityToMarkdown,
  citationCollectionToMarkdown,
} from "@/lib/reproducibility";
import type { LineageNodeType } from "@/lib/reproducibility/types";
import { PageHeader } from "@/components/app/page-header";

interface RunData {
  id: string;
  name: string;
  config: Record<string, unknown>;
  metrics: Record<string, number>;
  createdAt: string;
  startedAt: string;
  completedAt: string | null;
  dataset: {
    id: string;
    name: string;
    source: string;
    questionCount: number;
  };
  questionCount: number;
}

interface LineagePageProps {
  runs: RunData[];
}

const NODE_ICONS: Record<LineageNodeType, React.ReactNode> = {
  dataset: <Database size={16} />,
  chunking: <FileText size={16} />,
  embedding: <Cpu size={16} />,
  retrieval: <Search size={16} />,
  reranking: <ArrowRight size={16} />,
  prompt: <MessageSquare size={16} />,
  generation: <Cpu size={16} />,
  evaluation: <BarChart3 size={16} />,
  report: <FileText size={16} />,
  manifest: <FileText size={16} />,
};

const NODE_COLORS: Record<LineageNodeType, string> = {
  dataset: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  chunking: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  embedding: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  retrieval: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  reranking: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  prompt: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  generation: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  evaluation: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  report: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  manifest: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const PIPELINE_ORDER: LineageNodeType[] = [
  "dataset", "chunking", "embedding", "retrieval", "reranking", "prompt", "generation", "evaluation", "report",
];

export function LineagePage({ runs }: LineagePageProps) {
  const [selectedRun, setSelectedRun] = useState<string | null>(runs[0]?.id || null);
  const [selectedNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<"json" | "yaml">("json");
  const [copied, setCopied] = useState(false);
  const [diffRunA, setDiffRunA] = useState<string | null>(runs[0]?.id || null);
  const [diffRunB, setDiffRunB] = useState<string | null>(runs[1]?.id || null);
  const [activeTab, setActiveTab] = useState<"lineage" | "diff" | "reproducibility" | "citations">("lineage");

  const selectedRunData = runs.find((r) => r.id === selectedRun);

  const manifest = useMemo(() => {
    if (!selectedRunData) return null;
    return generateManifest({
      experimentName: selectedRunData.name,
      description: `Benchmark run: ${selectedRunData.name}`,
      author: "Kairos User",
      tags: ["benchmark", selectedRunData.dataset.name],
      dataset: selectedRunData.dataset,
      config: selectedRunData.config,
      results: {
        aggregatedMetrics: selectedRunData.metrics,
        perQuestionMetrics: [],
      },
    });
  }, [selectedRunData]);

  const lineageGraph = useMemo(() => {
    if (!manifest) return null;
    return buildLineageGraph({ manifest });
  }, [manifest]);

  const provenanceChain = useMemo(() => {
    if (!manifest) return null;
    return buildProvenanceChain({ manifest, actor: "Kairos User" });
  }, [manifest]);

  const reproducibilityScore = useMemo(() => {
    if (!manifest) return null;
    return computeReproducibilityScore({ manifest, provenanceChain: provenanceChain || undefined });
  }, [manifest, provenanceChain]);

  const citations = useMemo(() => {
    if (!manifest) return null;
    return generateCitations({ manifest });
  }, [manifest]);

  const diffResult = useMemo(() => {
    const runA = runs.find((r) => r.id === diffRunA);
    const runB = runs.find((r) => r.id === diffRunB);
    if (!runA || !runB) return null;

    return computeConfigurationDiff({
      configA: {
        id: runA.id,
        name: runA.name,
        timestamp: runA.createdAt,
        config: runA.config,
        metrics: runA.metrics,
      },
      configB: {
        id: runB.id,
        name: runB.name,
        timestamp: runB.createdAt,
        config: runB.config,
        metrics: runB.metrics,
      },
    });
  }, [runs, diffRunA, diffRunB]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleExport = () => {
    if (!manifest) return;
    const content = exportFormat === "json" ? manifestToJSON(manifest) : manifestToYAML(manifest);
    const blob = new Blob([content], { type: exportFormat === "json" ? "application/json" : "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-${manifest.manifestId}.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-500";
    if (score >= 0.6) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Experiment Lineage"
        description="Trace the complete lineage of your experiments from dataset to research report."
        purpose="Track experiment history and provenance."
        relatedPages={[
          { label: "Research Dashboard", href: "/app/research" },
          { label: "Evaluation", href: "/app/evaluation" },
        ]}
      />

      <div className="flex gap-2 border-b border-border pb-2">
        {(["lineage", "diff", "reproducibility", "citations"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-surface text-text-primary border-b-2 border-blue-500"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab === "lineage" && <GitBranch size={14} className="inline mr-1" />}
            {tab === "diff" && <ArrowRight size={14} className="inline mr-1" />}
            {tab === "reproducibility" && <CheckCircle2 size={14} className="inline mr-1" />}
            {tab === "citations" && <FileText size={14} className="inline mr-1" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "lineage" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Select Experiment</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRun(run.id)}
                  className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                    selectedRun === run.id
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "hover:bg-surface-hover text-text-secondary"
                  }`}
                >
                  <div className="font-medium truncate">{run.name}</div>
                  <div className="text-xs text-text-tertiary mt-0.5">{run.dataset.name}</div>
                </button>
              ))}
            </div>

            {manifest && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-xs font-semibold text-text-tertiary uppercase mb-2">Export Manifest</h3>
                <div className="flex gap-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as "json" | "yaml")}
                    className="flex-1 text-sm rounded border border-border bg-bg-primary px-2 py-1"
                  >
                    <option value="json">JSON</option>
                    <option value="yaml">YAML</option>
                  </select>
                  <button
                    onClick={handleExport}
                    className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="col-span-9 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Pipeline Lineage</h2>

            {lineageGraph ? (
              <div className="space-y-2">
                {PIPELINE_ORDER.map((nodeType, idx) => {
                  const node = lineageGraph.nodes.find((n) => n.type === nodeType);
                  if (!node) return null;

                  return (
                    <div key={node.id}>
                      <button
                        onClick={() => toggleNode(node.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          selectedNode === node.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-border hover:border-blue-300"
                        }`}
                      >
                        <div className={`p-1.5 rounded ${NODE_COLORS[node.type]}`}>
                          {NODE_ICONS[node.type]}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium text-text-primary">{node.name}</div>
                          <div className="text-xs text-text-tertiary">{node.description}</div>
                        </div>
                        <div className="text-xs text-text-tertiary">{node.version}</div>
                        {expandedNodes.has(node.id) ? (
                          <ChevronDown size={14} className="text-text-tertiary" />
                        ) : (
                          <ChevronRight size={14} className="text-text-tertiary" />
                        )}
                      </button>

                      {expandedNodes.has(node.id) && (
                        <div className="ml-8 mt-2 p-3 rounded-lg bg-bg-secondary text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(node.parameters).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-text-tertiary">{key}: </span>
                                <span className="text-text-primary font-mono text-xs">
                                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                          {node.metrics && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="text-xs font-semibold text-text-tertiary mb-2">Metrics</div>
                              <div className="grid grid-cols-3 gap-1">
                                {Object.entries(node.metrics).slice(0, 9).map(([k, v]) => (
                                  <div key={k} className="text-xs">
                                    <span className="text-text-tertiary">{k}: </span>
                                    <span className="text-text-primary">{typeof v === "number" ? v.toFixed(4) : String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {idx < PIPELINE_ORDER.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-px h-4 bg-border" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-text-tertiary">
                Select an experiment to view its lineage
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "diff" && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Configuration Diff</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-text-tertiary">Experiment A</label>
              <select
                value={diffRunA || ""}
                onChange={(e) => setDiffRunA(e.target.value)}
                className="w-full mt-1 text-sm rounded border border-border bg-bg-primary px-3 py-2"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-tertiary">Experiment B</label>
              <select
                value={diffRunB || ""}
                onChange={(e) => setDiffRunB(e.target.value)}
                className="w-full mt-1 text-sm rounded border border-border bg-bg-primary px-3 py-2"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {diffResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-bg-secondary">
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  Assessment: {diffResult.summary.overallAssessment.replace(/_/g, " ").toUpperCase()}
                </h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-text-tertiary">Changed: </span>
                    <span className="text-text-primary">{diffResult.summary.changedParameters}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Added: </span>
                    <span className="text-text-primary">{diffResult.summary.addedParameters}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Removed: </span>
                    <span className="text-text-primary">{diffResult.summary.removedParameters}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Significant: </span>
                    <span className="text-text-primary">{diffResult.summary.statisticallySignificant}</span>
                  </div>
                </div>
              </div>

              {diffResult.differences.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">Configuration Changes</h3>
                  <div className="space-y-1">
                    {diffResult.differences.map((d) => (
                      <div key={d.path} className="flex items-center gap-2 text-sm p-2 rounded bg-bg-secondary">
                        <span className={`w-5 text-center font-bold ${
                          d.type === "added" ? "text-green-500" : d.type === "removed" ? "text-red-500" : "text-amber-500"
                        }`}>
                          {d.type === "added" ? "+" : d.type === "removed" ? "-" : "~"}
                        </span>
                        <span className="text-text-primary font-medium">{d.label}</span>
                        <span className="text-xs text-text-tertiary px-1.5 py-0.5 rounded bg-bg-tertiary">{d.category}</span>
                        {d.type === "changed" && (
                          <span className="text-xs text-text-tertiary ml-auto">
                            {JSON.stringify(d.valueA)} → {JSON.stringify(d.valueB)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diffResult.metricDifferences.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">Metric Differences</h3>
                  <div className="space-y-1">
                    {diffResult.metricDifferences.map((m) => (
                      <div key={m.metric} className="flex items-center gap-2 text-sm p-2 rounded bg-bg-secondary">
                        <span className={`${
                          m.direction === "improved" ? "text-green-500" : m.direction === "degraded" ? "text-red-500" : "text-text-tertiary"
                        }`}>
                          {m.direction === "improved" ? "↑" : m.direction === "degraded" ? "↓" : "→"}
                        </span>
                        <span className="text-text-primary">{m.label}</span>
                        <span className="text-xs text-text-tertiary ml-auto">
                          {m.valueA.toFixed(4)} → {m.valueB.toFixed(4)}
                          ({m.absoluteDifference >= 0 ? "+" : ""}{m.absoluteDifference.toFixed(4)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(diffToMarkdown(diffResult))}
                  className="px-3 py-1.5 text-sm rounded border border-border hover:bg-surface-hover flex items-center gap-1"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  Copy Markdown
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "reproducibility" && reproducibilityScore && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Reproducibility Score</h2>

          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className={`text-4xl font-bold ${getScoreColor(reproducibilityScore.overall)}`}>
                {(reproducibilityScore.overall * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-text-tertiary">Overall Reproducibility Score</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {reproducibilityScore.factors.map((factor) => (
              <div key={factor.name} className="p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-primary">{factor.name}</span>
                  <span className={`text-sm font-bold ${getScoreColor(factor.score)}`}>
                    {(factor.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      factor.score >= 0.8 ? "bg-green-500" : factor.score >= 0.6 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${factor.score * 100}%` }}
                  />
                </div>
                <p className="text-xs text-text-tertiary mt-1">{factor.description}</p>
              </div>
            ))}
          </div>

          {reproducibilityScore.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Recommendations</h3>
              <div className="space-y-1">
                {reproducibilityScore.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-bg-secondary">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-text-secondary">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleCopy(reproducibilityToMarkdown(reproducibilityScore))}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-surface-hover flex items-center gap-1"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              Copy Markdown
            </button>
          </div>
        </div>
      )}

      {activeTab === "citations" && citations && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Citations</h2>

          <div className="space-y-4">
            {citations.citations.map((cite) => (
              <div key={cite.id} className="p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {cite.type}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{cite.title}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{cite.apa}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">BibTeX</h3>
            <pre className="p-3 rounded-lg bg-bg-secondary text-xs font-mono text-text-secondary overflow-x-auto">
              {citations.bibtexFile}
            </pre>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleCopy(citationCollectionToMarkdown(citations))}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-surface-hover flex items-center gap-1"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              Copy Markdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
