"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  BarChart3, Clock, Database, Play, Plus,
  Trash2, Download, Upload, FileText, FlaskConical, BookOpen,
  CheckCircle2, AlertCircle, ChevronRight,
  TrendingUp, Minus, SplitSquareHorizontal,
  Trophy, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputDialog } from "@/components/ui/input-dialog";
import {
  createDataset,
  importJsonDataset,
  getDataset,
  getRun,
  deleteDataset,
  deleteRun,
  startBenchmark,
  getReport,
  compareRuns,
  getLeaderboard,
} from "@/lib/actions/evaluation";
import { listKbsForLab } from "@/lib/actions/retrieval-lab";
import type { RetrievalConfig } from "@/lib/retrieval/types";
import { MetricCard, RadarChart, BarChart } from "@/lib/evaluation/visualization/charts";
import { METRIC_DEFINITIONS, type ComparisonResult, type EvaluationReport } from "@/lib/evaluation/types";

interface RunMetric {
  id: string;
  totalLatency: number | null;
  latencyEmbedding: number | null;
  latencyVectorSearch: number | null;
  chunkCount: number | null;
  embeddingModel: string | null;
  retrievalMode: string | null;
  createdAt: Date;
}

interface DatasetSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: { questions: number; runs: number };
}

interface BenchmarkRunSummary {
  id: string;
  name: string | null;
  status: string;
  aggregatedMetrics: unknown;
  createdAt: Date;
  dataset: { name: string };
  _count: { results: number };
}

interface Props {
  runs: RunMetric[];
  datasets: DatasetSummary[];
  benchmarkRuns: BenchmarkRunSummary[];
}

type ComparisonViewProps = ComparisonResult;
type ReportViewProps = EvaluationReport;

function TabButton({ active, label, icon: Icon, onClick }: {
  active: boolean; label: string; icon: typeof BarChart3; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-brand text-white" : "text-text-secondary hover:bg-surface-hover"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function formatMetric(value: number): string {
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

export function EvaluationDashboard({ runs, datasets, benchmarkRuns }: Props) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "datasets" | "runs" | "leaderboard" | "campaign" | "guide">("dashboard");
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonViewProps | null>(null);
  const [report, setReport] = useState<ReportViewProps | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Evaluation</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Benchmark your RAG system with standardized metrics
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={activeTab === "dashboard"} label="Dashboard" icon={BarChart3} onClick={() => setActiveTab("dashboard")} />
        <TabButton active={activeTab === "datasets"} label="Datasets" icon={Database} onClick={() => setActiveTab("datasets")} />
        <TabButton active={activeTab === "runs"} label="Benchmark Runs" icon={FlaskConical} onClick={() => setActiveTab("runs")} />
        <TabButton active={activeTab === "leaderboard"} label="Leaderboard" icon={Trophy} onClick={() => setActiveTab("leaderboard")} />
        <TabButton active={activeTab === "campaign"} label="Campaign" icon={Zap} onClick={() => setActiveTab("campaign")} />
        <TabButton active={activeTab === "guide"} label="Metrics Guide" icon={BookOpen} onClick={() => setActiveTab("guide")} />
      </div>

      {activeTab === "dashboard" && (
        <DashboardTab
          runs={runs}
          datasets={datasets}
          benchmarkRuns={benchmarkRuns}
        />
      )}
      {activeTab === "datasets" && (
        <DatasetsTab
          datasets={datasets}
          selectedDataset={selectedDataset}
          onSelect={setSelectedDataset}
        />
      )}
      {activeTab === "runs" && (
        <RunsTab
          runs={benchmarkRuns}
          compareA={compareA}
          compareB={compareB}
          setCompareA={setCompareA}
          setCompareB={setCompareB}
          comparison={comparison}
          report={report}
          setComparison={setComparison}
          setReport={setReport}
        />
      )}
      {activeTab === "leaderboard" && (
        <LeaderboardTab runs={benchmarkRuns} />
      )}
      {activeTab === "campaign" && (
        <CampaignTab datasets={datasets} />
      )}
      {activeTab === "guide" && <MetricsGuide />}
    </div>
  );
}

function DashboardTab({ runs, datasets, benchmarkRuns }: Props) {
  const expStats = useMemo(() => {
    const latencies = runs.map((r) => r.totalLatency).filter((v): v is number => v !== null);
    return {
      totalRuns: runs.length,
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      totalDatasets: datasets.length,
      completedBenchmarks: benchmarkRuns.length,
    };
  }, [runs, datasets, benchmarkRuns]);

  const recentBenchmarks = benchmarkRuns.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Experiment Runs"
          value={String(expStats.totalRuns)}
          footer="Retrieval lab experiments"
        />
        <MetricCard
          label="Avg Latency"
          value={`${expStats.avgLatency.toFixed(1)}ms`}
          footer="Across all experiment runs"
          higherIsBetter={false}
        />
        <MetricCard
          label="Benchmark Datasets"
          value={String(expStats.totalDatasets)}
          footer="Evaluation datasets created"
        />
        <MetricCard
          label="Completed Benchmarks"
          value={String(expStats.completedBenchmarks)}
          footer="Benchmark runs completed"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="!p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary mb-3">
            <Clock size={14} />
            Latency Timeline (last 50 runs)
          </div>
          {runs.length > 0 ? (
            <div className="flex items-end gap-1 h-24">
              {runs.slice(0, 50).reverse().map((r, _i) => {
                const maxLat = Math.max(...runs.map((x) => x.totalLatency ?? 0), 1);
                const h = ((r.totalLatency ?? 0) / maxLat) * 100;
                return (
                  <div
                    key={r.id}
                    className="flex-1 rounded-t bg-brand/60 hover:opacity-100 transition-opacity"
                    style={{ height: `${Math.max(h, 1)}%` }}
                    title={`${(r.totalLatency ?? 0).toFixed(1)}ms`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary py-8 text-center">No experiment runs yet</p>
          )}
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary mb-3">
            <FlaskConical size={14} />
            Recent Benchmark Runs
          </div>
          {recentBenchmarks.length > 0 ? (
            <div className="space-y-2">
              {recentBenchmarks.map((b) => {
                const metrics = b.aggregatedMetrics as Record<string, number> | null;
                return (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="font-medium">{b.name || "Unnamed Run"}</span>
                      <span className="text-text-secondary">— {b.dataset.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <span>{b._count.results} questions</span>
                      {metrics && <span>R@{formatMetric(metrics.avgRecallAtK ?? 0)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary py-8 text-center">Create a dataset and run a benchmark</p>
          )}
        </Card>
      </div>

      {benchmarkRuns.length > 0 && (
        <MetricsOverview benchmarkRuns={benchmarkRuns} />
      )}
    </div>
  );
}

function MetricsOverview({ benchmarkRuns }: { benchmarkRuns: BenchmarkRunSummary[] }) {
  const latestRun = benchmarkRuns[0];
  if (!latestRun) return null;

  const metrics = latestRun.aggregatedMetrics as Record<string, number> | null;
  if (!metrics) return null;

  const retrievalData = [
    { label: "Recall@K", value: metrics.avgRecallAtK ?? 0 },
    { label: "Precision@K", value: metrics.avgPrecisionAtK ?? 0 },
    { label: "Hit Rate", value: metrics.avgHitRate ?? 0 },
    { label: "MRR", value: metrics.avgMRR ?? 0 },
    { label: "nDCG", value: metrics.avgNDCG ?? 0 },
  ];

  const genData = metrics.avgFaithfulness != null
    ? [
        { label: "Faithfulness", value: metrics.avgFaithfulness },
        { label: "Ctx Precision", value: metrics.avgContextPrecision ?? 0 },
        { label: "Ctx Recall", value: metrics.avgContextRecall ?? 0 },
        { label: "Answer Rel.", value: metrics.avgAnswerRelevancy ?? 0 },
      ]
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="!p-4">
        <div className="text-sm font-medium mb-3">Latest Retrieval Metrics (Radar)</div>
        <div className="flex justify-center">
          <RadarChart data={retrievalData} size={260} />
        </div>
      </Card>
      <Card className="!p-4">
        <div className="text-sm font-medium mb-3">Retrieval Metrics (Bar)</div>
        <BarChart data={retrievalData} height={220} />
      </Card>
      {genData && (
        <Card className="!p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-3">Generation Metrics</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {genData.map((d) => (
              <MetricCard
                key={d.label}
                label={d.label}
                value={formatMetric(d.value)}
                higherIsBetter
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DatasetsTab({ datasets, selectedDataset, onSelect }: {
  datasets: DatasetSummary[];
  selectedDataset: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [datasetDetail, setDatasetDetail] = useState<{
    id: string; name: string; description: string | null;
    questions: Array<{ id: string; question: string; expectedAnswer: string | null }>;
    runs: Array<{ id: string; name: string | null; status: string; createdAt: Date }>;
  } | null>(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [benchmarkDatasetId, setBenchmarkDatasetId] = useState<string | null>(null);
  const [benchmarkKbId, setBenchmarkKbId] = useState("");
  const [benchmarkLabel, setBenchmarkLabel] = useState("");
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [availableKbs, setAvailableKbs] = useState<Array<{ name: string; id: string }>>([]);

  const loadDetail = useCallback(async (id: string) => {
    const d = await getDataset(id) as {
      id: string; name: string; description: string | null;
      questions: Array<{ id: string; question: string; expectedAnswer: string | null }>;
      runs: Array<{ id: string; name: string | null; status: string; createdAt: Date }>;
    };
    setDatasetDetail(d);
    onSelect(id);
  }, [onSelect]);

  const handleCreate = async () => {
    if (!name.trim() || !questionsText.trim()) return;
    setCreating(true);
    try {
      const questions = questionsText
        .split("\n")
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
        .map((q) => ({ question: q }));
      await createDataset({ name: name.trim(), description: description.trim() || undefined, source: source.trim() || undefined, questions });
      setName("");
      setDescription("");
      setSource("");
      setQuestionsText("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.[^/.]+$/, ""));
      await importJsonDataset(formData);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    try {
      await deleteDataset(deleteTargetId);
      if (selectedDataset === deleteTargetId) {
        onSelect(null);
        setDatasetDetail(null);
      }
      toast.success("Dataset deleted");
    } catch {
      toast.error("Failed to delete dataset");
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const openBenchmarkDialog = async (datasetId: string) => {
    const kbs = await listKbsForLab();
    if (kbs.length === 0) {
      toast.error("No knowledge bases available. Create one first.");
      return;
    }
    setAvailableKbs(kbs);
    setBenchmarkDatasetId(datasetId);
    setBenchmarkKbId("");
    setBenchmarkLabel("");
    setBenchmarkDialogOpen(true);
  };

  const handleRunBenchmark = async () => {
    if (!benchmarkDatasetId || !benchmarkKbId.trim()) return;
    setBenchmarkLoading(true);
    try {
      const config: RetrievalConfig = {
        topK: 4,
        similarityThreshold: 0.5,
        chunkStrategy: "fixed",
        chunkSize: 1000,
        chunkOverlap: 200,
        embeddingModel: "text-embedding-3-small",
        retrievalMode: "vector" as const,
        embeddingProvider: "openai",
      };
      await startBenchmark(benchmarkDatasetId, benchmarkKbId.trim(), config, benchmarkLabel.trim() || undefined);
      toast.success("Benchmark started! Check the Runs tab.");
      setBenchmarkDialogOpen(false);
    } catch (err) {
      toast.error(`Error: ${err}`);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Datasets ({datasets.length})
        </h2>
        <div className="flex gap-2">
          <input type="file" accept=".json" ref={fileRef} onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg hover:bg-surface-hover"
          >
            <Upload size={14} />
            {importing ? "Importing..." : "Import JSON"}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-brand text-white hover:bg-brand-hover"
          >
            <Plus size={14} />
            New Dataset
          </button>
        </div>
      </div>

      {showCreate && (
        <Card className="!p-4 space-y-3">
          <h3 className="text-sm font-medium">Create Dataset</h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dataset name"
            aria-label="Dataset name"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            aria-label="Description"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source (optional)"
            aria-label="Source"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg"
          />
          <textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            placeholder="One question per line..."
            rows={6}
            aria-label="Questions (one per line)"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg resize-none font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-sm rounded-lg border border-input hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !questionsText.trim()}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {datasets.length === 0 ? (
          <Card className="!p-8 text-center">
            <Database size={32} className="mx-auto mb-2 text-text-secondary" />
            <p className="text-sm text-text-secondary">No datasets yet. Create one or import a JSON file.</p>
          </Card>
        ) : (
          datasets.map((ds) => (
            <Card
              key={ds.id}
              className={`!p-4 cursor-pointer transition-colors hover:bg-surface-hover ${
                selectedDataset === ds.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => loadDetail(ds.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-text-secondary" />
                  <div>
                    <p className="font-medium text-sm">{ds.name}</p>
                    <p className="text-xs text-text-secondary">
                      {ds._count.questions} questions · {ds._count.runs} runs
                      {ds.description && ` · ${ds.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openBenchmarkDialog(ds.id); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-brand/10 text-brand hover:bg-brand-hover"
                  >
                    <Play size={12} />
                    Run
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDeleteDialog(ds.id); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"
                    aria-label="Delete dataset"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {datasetDetail && (
        <Card className="!p-4 space-y-3">
          <h3 className="text-sm font-medium">{datasetDetail.name} — Questions</h3>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {datasetDetail.questions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-2 text-sm p-2 rounded hover:bg-surface-hover">
                <span className="text-text-secondary w-6 shrink-0">#{i + 1}</span>
                <div className="flex-1">
                  <p>{q.question}</p>
                  {q.expectedAnswer && (
                    <p className="text-xs text-text-secondary mt-0.5">Expected: {q.expectedAnswer}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeleteTargetId(null); }}
        onConfirm={handleDelete}
        title="Delete Dataset"
        description="This will permanently delete this dataset and all its benchmark runs. This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteLoading}
      />

      {/* Benchmark Input Dialog */}
      <InputDialog
        open={benchmarkDialogOpen}
        onClose={() => { setBenchmarkDialogOpen(false); setBenchmarkDatasetId(null); }}
        onSubmit={async (value) => {
          if (!benchmarkKbId.trim()) {
            setBenchmarkKbId(value);
          } else {
            setBenchmarkLabel(value);
            await handleRunBenchmark();
          }
        }}
        title={benchmarkKbId ? "Run Benchmark" : "Select Knowledge Base"}
        description={benchmarkKbId ? "Optional: Enter a name for this benchmark run." : `Available: ${availableKbs.map((k) => `${k.name} (${k.id})`).join(", ")}`}
        placeholder={benchmarkKbId ? "Run name (optional)" : "Enter Knowledge Base ID"}
        confirmLabel={benchmarkKbId ? "Start Benchmark" : "Next"}
        isLoading={benchmarkLoading}
      />
    </div>
  );
}

function RunsTab({ runs, compareA, compareB, setCompareA, setCompareB, comparison, report, setComparison, setReport }: {
  runs: BenchmarkRunSummary[];
  compareA: string | null;
  compareB: string | null;
  setCompareA: (id: string | null) => void;
  setCompareB: (id: string | null) => void;
  comparison: ComparisonViewProps | null;
  report: ReportViewProps | null;
  setComparison: (v: ComparisonViewProps | null) => void;
  setReport: (v: ReportViewProps | null) => void;
}) {
  const [selectedRunDetail, setSelectedRunDetail] = useState<{
    id: string; name: string | null; status: string; aggregatedMetrics: Record<string, number> | null;
    dataset: { name: string };
    results: Array<{ id: string; retrievalMetrics: unknown; generationMetrics: unknown; totalLatencyMs: number | null; question: { question: string } }>;
  } | null>(null);

  const loadRunDetail = useCallback(async (id: string) => {
    const d = await getRun(id) as {
      id: string; name: string | null; status: string; aggregatedMetrics: Record<string, number> | null;
      dataset: { name: string };
      results: Array<{ id: string; retrievalMetrics: unknown; generationMetrics: unknown; totalLatencyMs: number | null; question: { question: string } }>;
    };
    setSelectedRunDetail(d);
  }, []);

  const handleCompare = async () => {
    if (!compareA || !compareB) return;
    const result = await compareRuns(compareA, compareB);
    setComparison(result as ComparisonResult);
  };

  const handleReport = async (id: string) => {
    const r = await getReport(id);
    setReport(r as EvaluationReport);
  };

  const completedRuns = runs.filter((r) => r.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Benchmark Runs ({runs.length})</h2>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={compareA || ""}
            onChange={(e) => setCompareA(e.target.value || null)}
            aria-label="Select Run A for comparison"
            className="px-2 py-1 text-xs rounded border border-border bg-bg"
          >
            <option value="">Select Run A</option>
            {completedRuns.map((r) => (
              <option key={r.id} value={r.id}>{r.name || `Run ${r.createdAt.toLocaleDateString()}`}</option>
            ))}
          </select>
          <span className="text-text-secondary">vs</span>
          <select
            value={compareB || ""}
            onChange={(e) => setCompareB(e.target.value || null)}
            aria-label="Select Run B for comparison"
            className="px-2 py-1 text-xs rounded border border-border bg-bg"
          >
            <option value="">Select Run B</option>
            {completedRuns.map((r) => (
              <option key={r.id} value={r.id}>{r.name || `Run ${r.createdAt.toLocaleDateString()}`}</option>
            ))}
          </select>
          <button
            onClick={handleCompare}
            disabled={!compareA || !compareB}
            className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
          >
            <SplitSquareHorizontal size={12} />
            Compare
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {runs.length === 0 ? (
          <Card className="!p-8 text-center">
            <FlaskConical size={32} className="mx-auto mb-2 text-text-secondary" />
            <p className="text-sm text-text-secondary">No benchmark runs yet. Run a benchmark from the Datasets tab.</p>
          </Card>
        ) : (
          runs.map((run) => {
            const metrics = run.aggregatedMetrics as Record<string, number> | null;
            return (
              <Card
                key={run.id}
                className="!p-4 cursor-pointer transition-colors hover:bg-surface-hover"
                onClick={() => loadRunDetail(run.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {run.status === "completed" ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <AlertCircle size={16} className="text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{run.name || `Run #${run.id.slice(0, 8)}`}</p>
                      <p className="text-xs text-text-secondary">
                        {run.dataset.name} · {run._count.results} questions · {new Date(run.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {metrics && (
                      <div className="flex gap-3 text-xs text-text-secondary">
                        <span>R@{formatMetric(metrics.avgRecallAtK ?? 0)}</span>
                        <span>P@{formatMetric(metrics.avgPrecisionAtK ?? 0)}</span>
                        {metrics.avgFaithfulness != null && <span>F:{formatMetric(metrics.avgFaithfulness)}</span>}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReport(run.id); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-brand/10 text-brand hover:bg-brand-hover"
                    >
                      <Download size={12} />
                      Report
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRun(run.id); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"
                      aria-label="Delete run"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {selectedRunDetail && (
        <RunDetailView run={selectedRunDetail} />
      )}

      {comparison && (
        <ComparisonView comparison={comparison} />
      )}

      {report && (
        <ReportView report={report} onClose={() => setReport(null)} />
      )}
    </div>
  );
}

function RunDetailView({ run }: {
  run: {
    id: string; name: string | null; status: string; aggregatedMetrics: Record<string, number> | null;
    dataset: { name: string };
    results: Array<{ id: string; retrievalMetrics: unknown; generationMetrics: unknown; totalLatencyMs: number | null; question: { question: string } }>;
  };
}) {
  const metrics = run.aggregatedMetrics;
  if (!metrics) return null;

  const retrievalKeys = [
    { key: "avgRecallAtK", label: "Recall@K" },
    { key: "avgPrecisionAtK", label: "Precision@K" },
    { key: "avgHitRate", label: "Hit Rate" },
    { key: "avgMRR", label: "MRR" },
    { key: "avgNDCG", label: "nDCG" },
  ];

  const genKeys = [
    { key: "avgFaithfulness", label: "Faithfulness" },
    { key: "avgContextPrecision", label: "Context Precision" },
    { key: "avgContextRecall", label: "Context Recall" },
    { key: "avgAnswerRelevancy", label: "Answer Relevancy" },
  ];

  const radarData = retrievalKeys.map((k) => ({ label: k.label, value: metrics[k.key] ?? 0 }));
  const barData = [...retrievalKeys, ...genKeys.filter((k) => metrics[k.key] != null)].map((k) => ({
    label: k.label, value: metrics[k.key] ?? 0,
  }));

  return (
    <Card className="!p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{run.name || "Run Details"} — {run.dataset.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          run.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700"
        }`}>
          {run.status}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {retrievalKeys.map((k) => (
          <MetricCard key={k.key} label={k.label} value={formatMetric(metrics[k.key] ?? 0)} higherIsBetter />
        ))}
      </div>

      {genKeys.some((k) => metrics[k.key] != null) && (
        <>
          <div className="text-sm font-medium">Generation Metrics</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {genKeys.filter((k) => metrics[k.key] != null).map((k) => (
              <MetricCard key={k.key} label={k.label} value={formatMetric(metrics[k.key] ?? 0)} higherIsBetter />
            ))}
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="text-sm font-medium mb-3">Radar</div>
          <div className="flex justify-center">
            <RadarChart data={radarData} size={240} />
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-3">Metrics Comparison</div>
          <BarChart data={barData} height={220} />
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Per-Question Results ({run.results.length})</div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {run.results.map((r, i) => {
            const rm = r.retrievalMetrics as { recallAtK: number } | null;
            return (
              <div key={r.id} className="flex items-center gap-3 text-xs p-2 rounded hover:bg-surface-hover">
                <span className="text-text-secondary w-6 shrink-0">#{i + 1}</span>
                <p className="flex-1 truncate">{r.question.question}</p>
                {rm && <span className="text-text-secondary w-16">R@{rm.recallAtK.toFixed(3)}</span>}
                {r.totalLatencyMs != null && <span className="text-text-secondary w-16">{r.totalLatencyMs.toFixed(0)}ms</span>}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function ComparisonView({ comparison }: { comparison: ComparisonViewProps }) {
  const { configA, configB, winner, differences } = comparison;

  const diffEntries = Object.entries(differences).filter(([key]) => key !== "avgLatencyMs");

  const chartDataA = diffEntries.map(([key, val]) => ({ label: key.replace("avg", ""), value: val.a }));
  const chartDataB = diffEntries.map(([key, val]) => ({ label: key.replace("avg", ""), value: val.b }));

  return (
    <Card className="!p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Comparison</h3>
        <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
          winner === "A" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
          winner === "B" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
          "bg-bg-secondary text-text-secondary"
        }`}>
          {winner === "tie" ? "Tie" : `${winner === "A" ? configA.label : configB.label} Wins`}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="text-xs text-text-secondary mb-2">{configA.label}</div>
          <BarChart data={chartDataA} height={200} showValues />
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-2">{configB.label}</div>
          <BarChart data={chartDataB} height={200} showValues />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4">Metric</th>
              <th className="text-right py-2 px-4">{configA.label}</th>
              <th className="text-right py-2 px-4">{configB.label}</th>
              <th className="text-right py-2 px-4">Diff</th>
              <th className="text-right py-2 pl-4">Better</th>
            </tr>
          </thead>
          <tbody>
            {diffEntries.map(([key, val]) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium">{key.replace("avg", "")}</td>
                <td className="text-right py-2 px-4 font-mono">{val.a.toFixed(4)}</td>
                <td className="text-right py-2 px-4 font-mono">{val.b.toFixed(4)}</td>
                <td className="text-right py-2 px-4 font-mono">
                  <span className={val.diff > 0 ? "text-emerald-500" : val.diff < 0 ? "text-red-500" : ""}>
                    {val.diff > 0 ? "+" : ""}{val.diff.toFixed(4)}
                  </span>
                </td>
                <td className="text-right py-2 pl-4">
                  {val.better === "tie" ? (
                    <Minus size={14} className="inline text-text-secondary" />
                  ) : val.better === "A" ? (
                    <span className="flex items-center justify-end gap-1 text-blue-500">
                      <TrendingUp size={14} /> {configA.label}
                    </span>
                  ) : (
                    <span className="flex items-center justify-end gap-1 text-purple-500">
                      <TrendingUp size={14} /> {configB.label}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReportView({ report, onClose }: { report: ReportViewProps; onClose: () => void }) {
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="!p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{report.title}</h3>
        <div className="flex gap-2">
          <button onClick={handleDownload} className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-brand text-white hover:bg-brand-hover">
            <Download size={12} /> Export JSON
          </button>
          <button onClick={onClose} className="px-3 py-1 text-xs rounded-lg border border-input hover:bg-surface-hover">
            Close
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs text-text-secondary mb-1">Dataset</div>
          <p className="text-sm font-medium">{report.dataset.name}</p>
          <p className="text-xs text-text-secondary">{report.dataset.questionCount} questions</p>
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-1">Date</div>
          <p className="text-sm">{new Date(report.date).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(report.metrics.retrieval).filter(([k]) => k !== "k").map(([key, val]) => (
          <MetricCard key={key} label={key} value={formatMetric(val as number)} higherIsBetter />
        ))}
        {report.metrics.generation && Object.entries(report.metrics.generation).map(([key, val]) => (
          <MetricCard key={key} label={key} value={formatMetric(val as number)} higherIsBetter />
        ))}
        <MetricCard label="Avg Latency" value={`${report.metrics.latency.totalMs.toFixed(1)}ms`} higherIsBetter={false} />
      </div>

      {report.observations.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">Observations</div>
          <ul className="space-y-1">
            {report.observations.map((obs, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <ChevronRight size={14} className="mt-0.5 shrink-0" />
                {obs}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">Recommendations</div>
          <ul className="space-y-1">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function MetricsGuide() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Metrics Guide</h2>
      <p className="text-sm text-text-secondary">
        Standard Information Retrieval and RAG evaluation metrics used in Kairos benchmarks.
      </p>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Retrieval Metrics</h3>
        {METRIC_DEFINITIONS.filter((m) => m.category === "retrieval").map((m) => (
          <Card key={m.id} className="!p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-medium text-sm">{m.name}</span>
                <span className="text-xs text-text-secondary ml-2">({m.id})</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                m.higherIsBetter ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700"
              }`}>
                {m.higherIsBetter ? "Higher is better" : "Lower is better"}
              </span>
            </div>
            <p className="text-sm text-text-secondary mb-2">{m.description}</p>
            <div className="bg-bg-secondary rounded-lg p-3 mb-2 font-mono text-xs">
              <div className="text-text-secondary mb-1">Formula:</div>
              {m.formula}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-text-secondary">
              <div>
                <span className="font-medium text-foreground">Interpretation:</span> {m.interpretation}
              </div>
              <div>
                <span className="font-medium text-foreground">Why it matters:</span> {m.whyItMatters}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Generation Metrics</h3>
        {METRIC_DEFINITIONS.filter((m) => m.category === "generation").map((m) => (
          <Card key={m.id} className="!p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-medium text-sm">{m.name}</span>
                <span className="text-xs text-text-secondary ml-2">({m.id})</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Higher is better
              </span>
            </div>
            <p className="text-sm text-text-secondary mb-2">{m.description}</p>
            <div className="bg-bg-secondary rounded-lg p-3 mb-2 font-mono text-xs">
              <div className="text-text-secondary mb-1">Formula:</div>
              {m.formula}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-text-secondary">
              <div>
                <span className="font-medium text-foreground">Interpretation:</span> {m.interpretation}
              </div>
              <div>
                <span className="font-medium text-foreground">Why it matters:</span> {m.whyItMatters}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LeaderboardTab({ runs }: { runs: BenchmarkRunSummary[] }) {
  const [leaderboard, setLeaderboard] = useState<Array<{
    rank: number; label: string; overallScore: number; isBest: boolean;
    recallAtK: number; precisionAtK: number; hitRate: number; mrr: number; ndcg: number; latencyMs: number;
  }> | null>(null);
  const [loading, setLoading] = useState(false);

  const completedRuns = runs.filter((r) => r.status === "completed");

  const loadLeaderboard = useCallback(async () => {
    if (completedRuns.length === 0) return;
    setLoading(true);
    try {
      const lb = await getLeaderboard(completedRuns.map((r) => r.id));
      setLeaderboard(lb);
    } catch (e) {
      console.error("Failed to load leaderboard", e);
    } finally {
      setLoading(false);
    }
  }, [completedRuns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Leaderboard</h2>
        <button
          onClick={loadLeaderboard}
          disabled={loading || completedRuns.length === 0}
          className="px-3 py-1.5 text-sm rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-40"
        >
          {loading ? "Loading..." : "Generate Leaderboard"}
        </button>
      </div>

      {completedRuns.length === 0 ? (
        <Card className="!p-6 text-center">
          <Trophy size={32} className="mx-auto mb-2 text-text-tertiary" />
          <p className="text-sm text-text-secondary">Complete benchmark runs to see the leaderboard.</p>
        </Card>
      ) : leaderboard ? (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">#</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Strategy</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Score</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Recall</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Precision</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">MRR</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">NDCG</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Latency</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.rank} className={`border-b border-border ${entry.isBest ? "bg-brand/5" : ""}`}>
                  <td className="px-4 py-3 font-medium">{entry.rank}</td>
                  <td className="px-4 py-3">
                    <span className={entry.isBest ? "font-semibold text-brand" : ""}>{entry.label}</span>
                    {entry.isBest && <span className="ml-2 text-xs text-brand">(Best)</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{entry.overallScore.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMetric(entry.recallAtK)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMetric(entry.precisionAtK)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMetric(entry.mrr)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMetric(entry.ndcg)}</td>
                  <td className="px-4 py-3 text-right font-mono">{entry.latencyMs.toFixed(0)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="!p-6 text-center">
          <p className="text-sm text-text-secondary">Click &quot;Generate Leaderboard&quot; to rank your benchmark runs.</p>
        </Card>
      )}
    </div>
  );
}

function CampaignTab({ datasets }: { datasets: DatasetSummary[] }) {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [selectedKb, setSelectedKb] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<{
    summary: { totalExperiments: number; bestStrategy: string; bestRecall: number; avgLatencyMs: number };
    strategyResults: Array<{ strategyLabel: string; metrics: Record<string, number> }>;
  } | null>(null);
  const [kbs, setKbs] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    listKbsForLab().then(setKbs).catch(() => {});
  }, []);

  const handleRunCampaign = async () => {
    if (!selectedDataset || !selectedKb) return;
    setRunning(true);
    setProgress("Initializing campaign...");
    try {
      const { runCampaign } = await import("@/lib/actions/evaluation");
      const res = await runCampaign(
        selectedDataset,
        selectedKb,
        [
          { name: "Vector", config: { retrievalStrategy: "vector", retrievalMode: "vector" } },
          { name: "BM25", config: { retrievalStrategy: "keyword", retrievalMode: "keyword" } },
          { name: "Hybrid", config: { retrievalStrategy: "hybrid", retrievalMode: "hybrid", vectorWeight: 1.0, keywordWeight: 1.0 } },
        ],
        ["default"],
        ["fixed"],
        [5, 10],
        campaignName || `Campaign ${new Date().toLocaleDateString()}`,
      );
      setResult(res);
      setProgress("Complete!");
    } catch (e) {
      setProgress(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Benchmark Campaign</h2>
      <Card className="!p-4 space-y-3">
        <p className="text-sm text-text-secondary">
          Run multiple retrieval strategies against a dataset to compare performance across configurations.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="campaign-dataset">Dataset</label>
            <select
              id="campaign-dataset"
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg"
            >
              <option value="">Select dataset...</option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>{ds.name} ({ds._count.questions} questions)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="campaign-kb">Knowledge Base</label>
            <select
              id="campaign-kb"
              value={selectedKb}
              onChange={(e) => setSelectedKb(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg"
            >
              <option value="">Select KB...</option>
              {kbs.map((kb) => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
          </div>
        </div>
        <input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Campaign name (optional)"
          aria-label="Campaign name"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunCampaign}
            disabled={running || !selectedDataset || !selectedKb}
            className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-40 flex items-center gap-2"
          >
            <Zap size={14} />
            {running ? "Running..." : "Run Campaign"}
          </button>
          {progress && <span className="text-sm text-text-secondary">{progress}</span>}
        </div>
      </Card>

      {result && (
        <Card className="!p-4 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Campaign Results</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Total Experiments" value={String(result.summary.totalExperiments)} />
            <MetricCard label="Best Strategy" value={result.summary.bestStrategy} />
            <MetricCard label="Best Recall" value={result.summary.bestRecall.toFixed(3)} />
            <MetricCard label="Avg Latency" value={`${result.summary.avgLatencyMs.toFixed(0)}ms`} />
          </div>
          <div className="space-y-2">
            {result.strategyResults.map((sr) => (
              <div key={sr.strategyLabel} className="flex items-center justify-between p-2 rounded-lg bg-bg-secondary text-sm">
                <span className="font-medium">{sr.strategyLabel}</span>
                <span className="text-text-secondary font-mono">
                  Recall: {formatMetric(sr.metrics.recallAtK ?? 0)} | Precision: {formatMetric(sr.metrics.precisionAtK ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
