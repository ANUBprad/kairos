"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  ChevronRight,
  Activity,
  Settings,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonStat } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createQualityGate,
  listQualityGates,
  deleteQualityGate,
  toggleQualityGate,
  checkQualityGate,
  getQualityGateResults,
  getQualityGateStats,
} from "@/lib/actions/quality-gates";
import type { QualityGateCondition, QualityGateInfo } from "@/lib/quality-gates";
import type { GateStats, QualityGateResultInfo } from "@/lib/quality-gates";

const METRICS = [
  { key: "faithfulness", label: "Faithfulness" },
  { key: "latency", label: "Latency (ms)" },
  { key: "hallucination_rate", label: "Hallucination Rate" },
  { key: "cost", label: "Cost ($)" },
  { key: "recall", label: "Recall" },
  { key: "precision", label: "Precision" },
];

const OPERATORS = [
  { key: "gt", label: ">" },
  { key: "gte", label: ">=" },
  { key: "lt", label: "<" },
  { key: "lte", label: "<=" },
  { key: "eq", label: "=" },
  { key: "neq", label: "!=" },
];

type GateWithStats = QualityGateInfo & {
  recentResults?: QualityGateResultInfo[];
};

interface ConditionDraft {
  id: string;
  metric: string;
  operator: string;
  value: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: string | number;
  icon: typeof Shield;
  color: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-tertiary">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
          )}
        </div>
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function PassFailBar({ results }: { results: QualityGateResultInfo[] }) {
  if (results.length === 0) return <span className="text-xs text-text-tertiary">No history</span>;

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const total = results.length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-surface-hover">
        {passed > 0 && (
          <div
            className="bg-success"
            style={{ width: `${(passed / total) * 100}%` }}
          />
        )}
        {failed > 0 && (
          <div
            className="bg-error"
            style={{ width: `${(failed / total) * 100}%` }}
          />
        )}
      </div>
      <span className="text-[10px] text-text-tertiary whitespace-nowrap">
        {passed}/{total}
      </span>
    </div>
  );
}

function ConditionRow({
  condition,
}: {
  condition: QualityGateCondition | ConditionDraft;
}) {
  const metric = METRICS.find((m) => m.key === condition.metric);
  const op = OPERATORS.find((o) => o.key === condition.operator);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-hover px-3 py-2">
      <span className="text-sm font-medium text-text-primary">
        {metric?.label ?? condition.metric}
      </span>
      <span className="text-xs text-brand font-semibold">
        {op?.label ?? condition.operator}
      </span>
      <span className="text-sm text-text-primary">{condition.value}</span>
    </div>
  );
}

function GateDetail({
  gate,
  onClose,
  onToggle,
  onDeleted,
}: {
  gate: QualityGateInfo;
  onClose: () => void;
  onToggle: (gateId: string, enabled: boolean) => void;
  onDeleted: (gateId: string) => void;
}) {
  const [results, setResults] = useState<QualityGateResultInfo[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [testMetrics, setTestMetrics] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    passed: boolean;
    score: number;
    results: { metric: string; passed: boolean; actual: number; threshold: number; operator: string }[];
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadResults() {
      setLoadingResults(true);
      const res = await getQualityGateResults(gate.id, { limit: 20 });
      if (res.success && res.results) {
        setResults(res.results);
      }
      setLoadingResults(false);
    }
    loadResults();
  }, [gate.id]);

  const handleTest = async () => {
    const metrics: Record<string, number> = {};
    for (const m of gate.conditions) {
      const val = testMetrics[m.metric];
      if (val !== undefined && val !== "") {
        metrics[m.metric] = parseFloat(val);
      }
    }

    setTesting(true);
    setTestResult(null);

    const res = await checkQualityGate(gate.id, metrics);
    if (res.success && "passed" in res) {
      setTestResult({
        passed: res.passed,
        score: res.score,
        results: res.results ?? [],
      });
    } else {
      toast.error(res.error ?? "Failed to test gate");
    }
    setTesting(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteQualityGate(gate.id);
    if (res.success) {
      toast.success("Gate deleted");
      onDeleted(gate.id);
      onClose();
    } else {
      toast.error(res.error ?? "Failed to delete gate");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl mx-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{gate.name}</h2>
              {gate.description && (
                <p className="text-sm text-text-secondary mt-1">{gate.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onToggle(gate.id, !gate.enabled)}
              >
                {gate.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                variant="danger-outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={14} />
              </Button>
              <button
                onClick={onClose}
                className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Settings size={14} className="text-text-tertiary" />
                Conditions ({gate.conditions.length})
              </h3>
              <div className="space-y-2">
                {gate.conditions.map((c) => (
                  <ConditionRow key={`${c.metric}-${c.operator}-${c.value}`} condition={c} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Play size={14} className="text-text-tertiary" />
                Test Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {gate.conditions.map((c) => (
                  <div key={c.metric}>
                    <label className="text-xs text-text-tertiary mb-1 block">
                      {METRICS.find((m) => m.key === c.metric)?.label ?? c.metric}
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`Threshold: ${c.value}`}
                      value={testMetrics[c.metric] ?? ""}
                      onChange={(e) =>
                        setTestMetrics((prev) => ({
                          ...prev,
                          [c.metric]: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Test Gate
              </Button>

              {testResult && (
                <div className={`mt-3 rounded-xl border p-4 ${testResult.passed ? "border-success/30 bg-success/5" : "border-error/30 bg-error/5"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.passed ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : (
                      <XCircle size={16} className="text-error" />
                    )}
                    <span className="text-sm font-semibold text-text-primary">
                      {testResult.passed ? "PASSED" : "FAILED"} (Score: {(testResult.score * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {testResult.results.map((r) => (
                      <div key={r.metric} className="flex items-center gap-2 text-xs">
                        {r.passed ? (
                          <CheckCircle2 size={12} className="text-success" />
                        ) : (
                          <XCircle size={12} className="text-error" />
                        )}
                        <span className="text-text-secondary">
                          {METRICS.find((m) => m.key === r.metric)?.label ?? r.metric}
                          : {r.actual.toFixed(4)} {OPERATORS.find((o) => o.key === r.operator)?.label} {r.threshold}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <BarChart3 size={14} className="text-text-tertiary" />
                Results History
              </h3>
              {loadingResults ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <p className="text-sm text-text-tertiary">No results recorded yet.</p>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-hover">
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Score</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            {r.passed ? (
                              <Badge variant="success">Passed</Badge>
                            ) : (
                              <Badge variant="info">Failed</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            {r.score !== null ? `${(r.score * 100).toFixed(0)}%` : "-"}
                          </td>
                          <td className="px-3 py-2 text-text-tertiary">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Quality Gate"
        description={`Are you sure you want to delete "${gate.name}"? This will remove all conditions and history.`}
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </>
  );
}

function CreateGateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (gate: QualityGateInfo) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [creating, setCreating] = useState(false);

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        metric: "faithfulness",
        operator: "gt",
        value: "",
      },
    ]);
  };

  const updateCondition = (id: string, field: keyof ConditionDraft, value: string) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Gate name is required");
      return;
    }
    if (conditions.length === 0) {
      toast.error("At least one condition is required");
      return;
    }

    const parsedConditions: QualityGateCondition[] = conditions.map((c) => ({
      metric: c.metric,
      operator: c.operator as QualityGateCondition["operator"],
      value: parseFloat(c.value),
    }));

    if (parsedConditions.some((c) => isNaN(c.value))) {
      toast.error("All condition values must be valid numbers");
      return;
    }

    setCreating(true);
    const result = await createQualityGate({
      name: name.trim(),
      description: description.trim() || undefined,
      conditions: parsedConditions,
    });

    if (result.success) {
      toast.success("Quality gate created");
      onCreated(result as QualityGateInfo);
      setName("");
      setDescription("");
      setConditions([]);
      onClose();
    } else {
      toast.error(result.error ?? "Failed to create gate");
    }
    setCreating(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !creating && onClose()}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Create Quality Gate</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
            disabled={creating}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary block mb-1">Name</label>
            <input
              type="text"
              placeholder="e.g., Production Quality Gate"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
              disabled={creating}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary block mb-1">
              Description <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Enforces minimum quality standards for production"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
              disabled={creating}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">Conditions</label>
              <Button variant="secondary" size="sm" onClick={addCondition} disabled={creating}>
                <Plus size={14} />
                Add Condition
              </Button>
            </div>

            {conditions.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-4 border border-dashed border-border rounded-lg">
                No conditions added yet. Click &quot;Add Condition&quot; to start.
              </p>
            ) : (
              <div className="space-y-2">
                {conditions.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <select
                      value={c.metric}
                      onChange={(e) => updateCondition(c.id, "metric", e.target.value)}
                      className="rounded-lg border border-border bg-bg px-2 py-2 text-sm text-text-primary outline-none focus:border-brand flex-1"
                      disabled={creating}
                    >
                      {METRICS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={c.operator}
                      onChange={(e) => updateCondition(c.id, "operator", e.target.value)}
                      className="rounded-lg border border-border bg-bg px-2 py-2 text-sm text-text-primary outline-none focus:border-brand w-20"
                      disabled={creating}
                    >
                      {OPERATORS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="any"
                      placeholder="Value"
                      value={c.value}
                      onChange={(e) => updateCondition(c.id, "value", e.target.value)}
                      className="rounded-lg border border-border bg-bg px-2 py-2 text-sm text-text-primary outline-none focus:border-brand w-24"
                      disabled={creating}
                    />
                    <button
                      onClick={() => removeCondition(c.id)}
                      className="text-text-tertiary hover:text-error transition-colors p-2 rounded-lg hover:bg-surface-hover"
                      disabled={creating}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-6">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Shield size={14} />
            )}
            Create Gate
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QualityGatesClient() {
  const [gates, setGates] = useState<GateWithStats[]>([]);
  const [stats, setStats] = useState<GateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGate, setSelectedGate] = useState<QualityGateInfo | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [gatesRes, statsRes] = await Promise.all([
      listQualityGates(),
      getQualityGateStats(),
    ]);

    if (gatesRes.success && gatesRes.gates) {
      const gatesWithResults = await Promise.all(
        gatesRes.gates.map(async (gate) => {
          const resultsRes = await getQualityGateResults(gate.id, { limit: 10 });
          return {
            ...gate,
            recentResults: resultsRes.success ? resultsRes.results ?? [] : [],
          };
        })
      );
      setGates(gatesWithResults);
    }

    if (statsRes.success && "totalGates" in statsRes) {
      setStats({
        totalGates: statsRes.totalGates,
        enabledGates: statsRes.enabledGates,
        totalResults: statsRes.totalResults,
        passedResults: statsRes.passedResults,
        failedResults: statsRes.failedResults,
        passRate: statsRes.passRate,
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (gateId: string, enabled: boolean) => {
    const res = await toggleQualityGate(gateId, enabled);
    if (res.success) {
      setGates((prev) =>
        prev.map((g) => (g.id === gateId ? { ...g, enabled } : g))
      );
      setStats((prev) =>
        prev
          ? {
              ...prev,
              enabledGates: enabled
                ? prev.enabledGates + 1
                : prev.enabledGates - 1,
            }
          : prev
      );
      toast.success(`Gate ${enabled ? "enabled" : "disabled"}`);
    } else {
      toast.error(res.error ?? "Failed to toggle gate");
    }
  };

  const handleGateCreated = (gate: QualityGateInfo) => {
    setGates((prev) => [{ ...gate, recentResults: [] }, ...prev]);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalGates: prev.totalGates + 1,
            enabledGates: gate.enabled ? prev.enabledGates + 1 : prev.enabledGates,
          }
        : prev
    );
  };

  const handleGateDeleted = (gateId: string) => {
    const gate = gates.find((g) => g.id === gateId);
    setGates((prev) => prev.filter((g) => g.id !== gateId));
    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalGates: prev.totalGates - 1,
            enabledGates: gate?.enabled ? prev.enabledGates - 1 : prev.enabledGates,
          }
        : prev
    );
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Quality Gates"
          description="Define and enforce quality thresholds for your evaluation metrics."
          purpose="Ensure your RAG system meets minimum quality standards before deployment."
          nextAction={{ label: "Evaluation", href: "/app/evaluation" }}
          relatedPages={[
            { label: "Evaluation", href: "/app/evaluation" },
            { label: "Benchmark Explorer", href: "/app/benchmark-explorer" },
          ]}
        />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Quality Gates"
        description="Define and enforce quality thresholds for your evaluation metrics."
        purpose="Ensure your RAG system meets minimum quality standards before deployment."
        nextAction={{ label: "Evaluation", href: "/app/evaluation" }}
        relatedPages={[
          { label: "Evaluation", href: "/app/evaluation" },
          { label: "Benchmark Explorer", href: "/app/benchmark-explorer" },
        ]}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="Total Gates"
          value={stats?.totalGates ?? 0}
          icon={Shield}
          color="bg-brand/10 text-brand"
        />
        <StatCard
          label="Active Gates"
          value={stats?.enabledGates ?? 0}
          icon={Activity}
          color="bg-success/10 text-success"
        />
        <StatCard
          label="Pass Rate"
          value={stats ? `${(stats.passRate * 100).toFixed(0)}%` : "0%"}
          icon={CheckCircle2}
          color="bg-info/10 text-info"
        />
        <StatCard
          label="Total Evaluations"
          value={stats?.totalResults ?? 0}
          icon={BarChart3}
          color="bg-warning/10 text-warning"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Quality Gates</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          Create Gate
        </Button>
      </div>

      {gates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Shield size={40} className="mb-3 text-text-tertiary" />
          <p className="text-sm font-medium text-text-secondary">No quality gates configured</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Create your first quality gate to enforce metric thresholds.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} />
            Create Gate
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {gates.map((gate) => (
            <Card
              key={gate.id}
              className="p-4 cursor-pointer hover:border-border-hover transition-all"
              onClick={() => setSelectedGate(gate)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {gate.name}
                    </h3>
                    <Badge variant={gate.enabled ? "success" : "default"}>
                      {gate.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  {gate.description && (
                    <p className="text-xs text-text-tertiary mt-1 truncate">
                      {gate.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-text-tertiary">
                      {gate.conditions.length} condition{gate.conditions.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 max-w-[200px]">
                      <PassFailBar results={gate.recentResults ?? []} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(gate.id, !gate.enabled);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      gate.enabled ? "bg-success" : "bg-surface-hover"
                    }`}
                    aria-label={`Toggle ${gate.name}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        gate.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                      }`}
                    />
                  </button>
                  <ChevronRight size={16} className="text-text-tertiary" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateGateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleGateCreated}
      />

      {selectedGate && (
        <GateDetail
          gate={selectedGate}
          onClose={() => setSelectedGate(null)}
          onToggle={(gateId, enabled) => {
            handleToggle(gateId, enabled);
            setSelectedGate((prev) =>
              prev && prev.id === gateId ? { ...prev, enabled } : prev
            );
          }}
          onDeleted={handleGateDeleted}
        />
      )}
    </div>
  );
}
