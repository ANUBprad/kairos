"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Activity,
  Clock,
  DollarSign,
  ShieldAlert,
  AlertTriangle,
  Layers,
  RefreshCw,
  CheckCircle2,
  Crosshair,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { traceStats } from "@/lib/actions/observability";
import { costSummary } from "@/lib/actions/cost";
import { driftStats, listDriftAlerts } from "@/lib/actions/drift";

type TraceStatsResult = Awaited<ReturnType<typeof traceStats>>;
type CostSummaryResult = Awaited<ReturnType<typeof costSummary>>;
type DriftStatsResult = Awaited<ReturnType<typeof driftStats>>;
type DriftAlertRow = Awaited<ReturnType<typeof listDriftAlerts>>[number];

const STATUS_COLORS: Record<string, string> = {
  OK: "#22C55E",
  ERROR: "#EF4444",
  TIMEOUT: "#F59E0B",
  CANCELLED: "#8B8B8B",
};

const CHART_COLORS = ["#FF5A0A", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];

function BarChartSimple({
  data,
  height = 180,
  color = "#FF5A0A",
  yFormatter,
  className,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  yFormatter?: (v: number) => string;
  className?: string;
}) {
  const padding = { top: 12, bottom: 28, left: 0, right: 0 };
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 80 / data.length;

  return (
    <div className={cn("w-full overflow-hidden", className)}>
      <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
        {[0, 0.5, 1].map((frac, i) => {
          const y = padding.top + plotH * (1 - frac);
          return (
            <g key={i}>
              <line x1="0" y1={y} x2="100" y2={y} stroke="var(--color-border, #2A2A2A)" strokeWidth="0.2" strokeDasharray="1,1" />
              <text x="0.5" y={y - 0.5} fill="var(--color-text-tertiary, #8B8B8B)" fontSize="2.2">
                {yFormatter ? yFormatter(max * frac) : (max * frac).toFixed(1)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = 10 + i * barW;
          const barH = (d.value / max) * plotH;
          const y = padding.top + plotH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW * 0.7} height={barH} fill={color} rx="0.5" opacity="0.85" />
              {i % Math.max(1, Math.floor(data.length / 8)) === 0 && (
                <text x={x + barW * 0.35} y={height - 4} fill="var(--color-text-tertiary, #8B8B8B)" fontSize="1.8" textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PieChartSimple({
  segments,
  size = 160,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  className?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const cx = 50;
  const cy = 50;
  const r = 38;

  let cumAngle = -Math.PI / 2;
  const arcs = segments.map((seg) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...seg, d, percentage: ((seg.value / total) * 100).toFixed(1) };
  });

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {arcs.map((arc, i) => (
          <path key={i} d={arc.d} fill={arc.color} opacity="0.85" />
        ))}
      </svg>
      <div className="space-y-1.5">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-text-secondary truncate">{arc.label}</span>
            <span className="font-mono text-text-primary ml-auto">{arc.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: typeof Activity;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover">
            <Icon size={16} className="text-text-secondary" />
          </div>
          <span className="text-xs font-medium text-text-secondary">{label}</span>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-text-primary font-mono tabular-nums tracking-tight">
          {value}
        </span>
        {unit && <span className="text-sm text-text-tertiary mb-0.5">{unit}</span>}
      </div>
    </Card>
  );
}

function NotCollected({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Activity;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
        <Icon size={18} className="text-text-tertiary" />
      </div>
      <p className="text-sm font-medium text-text-secondary mt-3">{title}</p>
      <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">{hint}</p>
    </div>
  );
}

type Range = "7d" | "14d" | "30d";

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "14d": 14, "30d": 30 };

export function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>("30d");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [trace, setTrace] = useState<TraceStatsResult | null>(null);
  const [cost, setCost] = useState<CostSummaryResult | null>(null);
  const [drift, setDrift] = useState<DriftStatsResult | null>(null);
  const [alerts, setAlerts] = useState<DriftAlertRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    async function load() {
      try {
        const days = RANGE_DAYS[range];
        const [t, c, d, a] = await Promise.all([
          traceStats(days),
          costSummary(days),
          driftStats(days),
          listDriftAlerts(),
        ]);
        if (cancelled) return;
        setTrace(t);
        setCost(c);
        setDrift(d);
        setAlerts(a);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  const statusSegments = useMemo(() => {
    if (!trace?.statusBreakdown) return [];
    return trace.statusBreakdown
      .filter((s) => s._count > 0)
      .map((s) => ({
        label: String(s.status),
        value: s._count,
        color: STATUS_COLORS[String(s.status)] ?? "#8B8B8B",
      }));
  }, [trace]);

  const providerRows = useMemo(() => {
    if (!trace?.byProvider) return [];
    return trace.byProvider
      .filter((p) => p._count > 0)
      .map((p) => ({
        provider: p.provider ?? "unknown",
        requests: p._count,
        avgLatencyMs: p._avg.durationMs ?? 0,
      }));
  }, [trace]);

  const dailyCosts = useMemo(() => {
    if (!cost?.dailyCosts) return [];
    return cost.dailyCosts
      .filter((d) => (d._sum.cost ?? 0) > 0)
      .map((d) => ({
        label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: d._sum.cost ?? 0,
      }));
  }, [cost]);

  const tokenSegments = useMemo(() => {
    if (!cost?.byModel) return [];
    return cost.byModel
      .filter((m) => (m._sum.totalTokens ?? 0) > 0)
      .map((m, i) => ({
        label: String(m.model ?? "unknown"),
        value: m._sum.totalTokens ?? 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [cost]);

  if (loadState === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <Card className="p-10 text-center">
        <AlertTriangle size={24} className="mx-auto text-warning mb-3" />
        <p className="text-sm font-medium text-text-primary">Failed to load analytics data</p>
        <p className="text-xs text-text-tertiary mt-1">
          Trace and cost data could not be fetched. Refresh to try again.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          <RefreshCw size={14} className="mr-1" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Analytics Dashboard</h2>
          <p className="text-sm text-text-secondary mt-1">
            Real production metrics from traces, usage, and drift detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "14d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                range === r ? "bg-brand text-white" : "text-text-secondary hover:bg-surface-hover"
              )}
            >
              {r}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="API Requests"
          value={(trace?.totalTraces ?? 0).toLocaleString()}
          icon={BarChart3}
        />
        <SummaryCard
          label="Avg Latency"
          value={Math.round(trace?.avgDurationMs ?? 0).toLocaleString()}
          unit="ms"
          icon={Clock}
        />
        <SummaryCard
          label="Error Rate"
          value={(trace?.errorRate ?? 0).toFixed(1)}
          unit="%"
          icon={Activity}
        />
        <SummaryCard
          label="Total Cost"
          value={`$${(cost?.totalCost ?? 0).toFixed(2)}`}
          icon={DollarSign}
        />
        <SummaryCard
          label="Open Drifts"
          value={String(drift?.open ?? 0)}
          icon={ShieldAlert}
        />
        <SummaryCard
          label="Drift Alerts"
          value={String(drift?.total ?? 0)}
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Trace Status Breakdown</h3>
          </div>
          {statusSegments.length > 0 ? (
            <PieChartSimple segments={statusSegments} />
          ) : (
            <NotCollected
              icon={Activity}
              title="No traces recorded yet"
              hint="Traces are created when the assistant handles a turn in this workspace."
            />
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">API Requests by Provider</h3>
          </div>
          {providerRows.length > 0 ? (
            <BarChartSimple
              data={providerRows.map((p) => ({ label: p.provider, value: p.requests }))}
              height={180}
              color="#3B82F6"
              yFormatter={(v) => v.toLocaleString()}
            />
          ) : (
            <NotCollected
              icon={BarChart3}
              title="No provider usage yet"
              hint="Request counts appear once the first traced turn is recorded."
            />
          )}
          {providerRows.length > 0 && (
            <div className="mt-3 text-xs text-text-tertiary text-center">
              Total: {providerRows.reduce((s, p) => s + p.requests, 0).toLocaleString()} calls
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crosshair size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Evaluation Quality</h3>
          </div>
          <NotCollected
            icon={Crosshair}
            title="Not yet collected"
            hint="Faithfulness, groundedness, and hallucination scores are not recorded for this workspace yet. When an evaluation pipeline writes scores they will appear here."
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Regression History</h3>
          </div>
          {alerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 font-medium text-text-secondary">Metric</th>
                    <th className="text-left py-2 px-3 font-medium text-text-secondary">Severity</th>
                    <th className="text-left py-2 px-3 font-medium text-text-secondary">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-text-secondary">Delta</th>
                    <th className="text-right py-2 pl-3 font-medium text-text-secondary">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((al) => {
                    const sev = String(al.severity).toLowerCase();
                    const st = String(al.status).toLowerCase();
                    return (
                      <tr key={al.id} className="border-b border-border/50 group">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-text-primary">{al.metric}</div>
                          <div className="text-text-tertiary mt-0.5 max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible">
                            {String(al.message)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              sev === "critical" || sev === "error"
                                ? "warning"
                                : sev === "warning"
                                ? "info"
                                : "default"
                            }
                          >
                            {String(al.severity)}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              st === "resolved"
                                ? "success"
                                : st === "acknowledged"
                                ? "info"
                                : st === "ignored"
                                ? "default"
                                : "warning"
                            }
                          >
                            {String(al.status)}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className={al.deviationPercent > 0 ? "text-warning" : "text-success"}>
                            {al.deviationPercent > 0 ? "+" : ""}
                            {Number(al.deviationPercent).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-right text-text-tertiary">
                          {new Date(al.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <NotCollected
              icon={CheckCircle2}
              title="No drift alerts detected"
              hint="Regressions detected by drift detection on latency, quality, and cost appear here."
            />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Daily Cost</h3>
          </div>
          {dailyCosts.length > 0 ? (
            <BarChartSimple
              data={dailyCosts}
              height={180}
              color="#F59E0B"
              yFormatter={(v) => `$${v.toFixed(1)}`}
            />
          ) : (
            <NotCollected
              icon={DollarSign}
              title="Not yet collected"
              hint="Cost ledgering has not recorded spending for this workspace yet. No cost is shown rather than a fabricated estimate."
            />
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Token Usage by Model</h3>
          </div>
          {tokenSegments.length > 0 ? (
            <>
              <PieChartSimple segments={tokenSegments} />
              <div className="mt-3 text-xs text-text-tertiary text-center">
                Total: {(cost?.totalTokens ?? 0).toLocaleString()} tokens
              </div>
            </>
          ) : (
            <NotCollected
              icon={Layers}
              title="Not yet collected"
              hint="Token usage per model is not recorded for this workspace yet."
            />
          )}
        </Card>
      </div>
    </div>
  );
}