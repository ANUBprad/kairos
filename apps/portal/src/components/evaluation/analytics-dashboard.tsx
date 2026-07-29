"use client";

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Activity,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Layers,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrendPoint {
  date: string;
  faithfulness: number;
  groundedness: number;
  hallucination: number;
  cost: number;
  latency: number;
}

interface PromptImprovement {
  id: string;
  promptName: string;
  version: string;
  previousVersion: string;
  beforeFaithfulness: number;
  afterFaithfulness: number;
  beforeGroundedness: number;
  afterGroundedness: number;
  date: string;
}

interface RegressionEntry {
  id: string;
  metric: string;
  severity: "critical" | "warning" | "info";
  description: string;
  detectedAt: string;
  status: "open" | "investigating" | "resolved";
  deltaPercent: number;
}

interface TokenUsage {
  model: string;
  tokens: number;
  color: string;
}

interface ProviderCalls {
  provider: string;
  calls: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function generateTrendData(): TrendPoint[] {
  const data: TrendPoint[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const baseF = 0.82 + Math.sin(i / 5) * 0.04;
    const baseG = 0.78 + Math.cos(i / 7) * 0.05;
    data.push({
      date: d.toISOString().slice(0, 10),
      faithfulness: Math.round((baseF + (Math.random() - 0.5) * 0.03) * 1000) / 1000,
      groundedness: Math.round((baseG + (Math.random() - 0.5) * 0.03) * 1000) / 1000,
      hallucination: Math.round((0.12 + (Math.random() - 0.5) * 0.04) * 1000) / 1000,
      cost: Math.round((2.4 + Math.sin(i / 4) * 0.8 + (Math.random() - 0.5) * 0.3) * 100) / 100,
      latency: Math.round(180 + Math.sin(i / 6) * 30 + (Math.random() - 0.5) * 20),
    });
  }
  return data;
}

const MOCK_PROMPT_IMPROVEMENTS: PromptImprovement[] = [
  {
    id: "pi-1",
    promptName: "RAG Answer Generator",
    version: "v3.2",
    previousVersion: "v3.1",
    beforeFaithfulness: 0.78,
    afterFaithfulness: 0.87,
    beforeGroundedness: 0.72,
    afterGroundedness: 0.84,
    date: "2026-07-28",
  },
  {
    id: "pi-2",
    promptName: "Summarization Chain",
    version: "v2.0",
    previousVersion: "v1.9",
    beforeFaithfulness: 0.81,
    afterFaithfulness: 0.85,
    beforeGroundedness: 0.79,
    afterGroundedness: 0.82,
    date: "2026-07-25",
  },
  {
    id: "pi-3",
    promptName: "Citation Extractor",
    version: "v1.4",
    previousVersion: "v1.3",
    beforeFaithfulness: 0.74,
    afterFaithfulness: 0.81,
    beforeGroundedness: 0.70,
    afterGroundedness: 0.78,
    date: "2026-07-22",
  },
  {
    id: "pi-4",
    promptName: "Code Review Assistant",
    version: "v2.1",
    previousVersion: "v2.0",
    beforeFaithfulness: 0.85,
    afterFaithfulness: 0.89,
    beforeGroundedness: 0.80,
    afterGroundedness: 0.86,
    date: "2026-07-19",
  },
];

const MOCK_REGRESSIONS: RegressionEntry[] = [
  {
    id: "reg-1",
    metric: "Faithfulness",
    severity: "critical",
    description: "Faithfulness dropped 8.2% after deploying prompt v3.0 on production traffic.",
    detectedAt: "2026-07-27T14:30:00Z",
    status: "investigating",
    deltaPercent: -8.2,
  },
  {
    id: "reg-2",
    metric: "Latency",
    severity: "warning",
    description: "P95 latency increased from 210ms to 285ms after embedding model change.",
    detectedAt: "2026-07-25T09:15:00Z",
    status: "open",
    deltaPercent: 35.7,
  },
  {
    id: "reg-3",
    metric: "Hallucination Rate",
    severity: "warning",
    description: "Hallucination rate rose to 0.18 in the summarization chain.",
    detectedAt: "2026-07-23T16:45:00Z",
    status: "resolved",
    deltaPercent: 22.4,
  },
  {
    id: "reg-4",
    metric: "Groundedness",
    severity: "info",
    description: "Minor groundedness dip in citation extractor on low-context queries.",
    detectedAt: "2026-07-20T11:00:00Z",
    status: "resolved",
    deltaPercent: -3.1,
  },
  {
    id: "reg-5",
    metric: "Cost",
    severity: "warning",
    description: "Daily API cost exceeded budget threshold for 3 consecutive days.",
    detectedAt: "2026-07-18T08:00:00Z",
    status: "resolved",
    deltaPercent: 41.0,
  },
];

const MOCK_TOKEN_USAGE: TokenUsage[] = [
  { model: "gpt-4o", tokens: 1240000, color: "#FF5A0A" },
  { model: "gpt-4o-mini", tokens: 3800000, color: "#3B82F6" },
  { model: "claude-3.5-sonnet", tokens: 620000, color: "#22C55E" },
  { model: "text-embedding-3-small", tokens: 5100000, color: "#F59E0B" },
  { model: "text-embedding-3-large", tokens: 980000, color: "#8B5CF6" },
];

const MOCK_PROVIDER_CALLS: ProviderCalls[] = [
  { provider: "OpenAI", calls: 14230, color: "#FF5A0A" },
  { provider: "Anthropic", calls: 3840, color: "#3B82F6" },
  { provider: "Internal", calls: 8920, color: "#22C55E" },
];

// ---------------------------------------------------------------------------
// SVG Chart Helpers
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  faithfulness: "#FF5A0A",
  groundedness: "#3B82F6",
  hallucination: "#EF4444",
  cost: "#F59E0B",
};

function LineChart({
  data,
  lines,
  height = 200,
  showGrid = true,
  yFormatter,
  className,
}: {
  data: TrendPoint[];
  lines: { key: keyof TrendPoint; color: string; label: string }[];
  height?: number;
  showGrid?: boolean;
  yFormatter?: (v: number) => string;
  className?: string;
}) {
  const padding = { top: 12, bottom: 28, left: 0, right: 0 };
  const plotH = height - padding.top - padding.bottom;

  const allValues = data.flatMap((d) => lines.map((l) => d[l.key] as number));
  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);
  const range = globalMax - globalMin || 1;

  const linePaths = lines.map((line) => {
    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = padding.top + plotH - (((d[line.key] as number) - globalMin) / range) * plotH;
      return `${x},${y}`;
    });
    return { ...line, path: pts.join(" ") };
  });

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const y = padding.top + plotH * (1 - frac);
    const val = globalMin + range * frac;
    return { y, label: yFormatter ? yFormatter(val) : val.toFixed(2) };
  });

  const xLabels = data
    .filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0)
    .map((d) => {
      const idx = data.indexOf(d);
      const x = (idx / (data.length - 1)) * 100;
      return { x, label: d.date.slice(5) };
    });

  return (
    <div className={cn("w-full overflow-hidden", className)}>
      <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
        {showGrid &&
          gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1="0" y1={g.y} x2="100" y2={g.y}
                stroke="var(--color-border, #2A2A2A)" strokeWidth="0.2" strokeDasharray="1,1"
              />
              <text x="0.5" y={g.y - 0.5} fill="var(--color-text-tertiary, #8B8B8B)" fontSize="2.2" dominantBaseline="auto">
                {g.label}
              </text>
            </g>
          ))}
        {linePaths.map((lp) => (
          <polyline
            key={lp.key as string}
            points={lp.path}
            fill="none"
            stroke={lp.color}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={height - 2} fill="var(--color-text-tertiary, #8B8B8B)" fontSize="2" textAnchor="middle">
            {xl.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

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

  const gridLines = [0, 0.5, 1].map((frac) => {
    const y = padding.top + plotH * (1 - frac);
    return { y, label: yFormatter ? yFormatter(max * frac) : (max * frac).toFixed(1) };
  });

  return (
    <div className={cn("w-full overflow-hidden", className)}>
      <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1="0" y1={g.y} x2="100" y2={g.y} stroke="var(--color-border, #2A2A2A)" strokeWidth="0.2" strokeDasharray="1,1" />
            <text x="0.5" y={g.y - 0.5} fill="var(--color-text-tertiary, #8B8B8B)" fontSize="2.2">
              {g.label}
            </text>
          </g>
        ))}
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

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon: Icon,
  sparkline,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon: typeof TrendingUp;
  sparkline?: number[];
  className?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-text-tertiary";

  return (
    <Card className={cn("p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover">
            <Icon size={16} className="text-text-secondary" />
          </div>
          <span className="text-xs font-medium text-text-secondary">{label}</span>
        </div>
        {trend && (
          <div className={cn("flex items-center gap-0.5", trendColor)}>
            <TrendIcon size={12} />
            {trendValue && <span className="text-[10px] font-medium">{trendValue}</span>}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-text-primary font-mono tabular-nums tracking-tight">
          {value}
        </span>
        {unit && <span className="text-sm text-text-tertiary mb-0.5">{unit}</span>}
      </div>
      {sparkline && sparkline.length >= 2 && (
        <svg viewBox="0 0 60 20" className="w-16 h-5 opacity-50">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={sparkline
              .map((v, i) => {
                const min = Math.min(...sparkline);
                const max = Math.max(...sparkline);
                const range = max - min || 1;
                return `${(i / (sparkline.length - 1)) * 60},${20 - ((v - min) / range) * 20}`;
              })
              .join(" ")}
          />
        </svg>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d">("30d");
  const trendData = useMemo(() => generateTrendData(), []);

  const visibleData = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
    return trendData.slice(-days);
  }, [trendData, timeRange]);

  const summary = useMemo(() => {
    const latest = trendData[trendData.length - 1];
    const prev = trendData[trendData.length - 8] || trendData[0];
    const avgF = trendData.reduce((s, d) => s + d.faithfulness, 0) / trendData.length;
    const avgL = trendData.reduce((s, d) => s + d.latency, 0) / trendData.length;
    const totalCost = trendData.reduce((s, d) => s + d.cost, 0);
    const passRate = trendData.filter((d) => d.faithfulness >= 0.8).length / trendData.length;

    const fDelta = latest.faithfulness - prev.faithfulness;
    const lDelta = latest.latency - prev.latency;
    const cDelta = latest.cost - prev.cost;

    return {
      totalEvaluations: 12847,
      avgFaithfulness: avgF,
      avgLatency: avgL,
      totalCost,
      passRate,
      activeReviews: 23,
      fTrend: fDelta > 0.005 ? "up" as const : fDelta < -0.005 ? "down" as const : "neutral" as const,
      fTrendVal: `${fDelta > 0 ? "+" : ""}${(fDelta * 100).toFixed(1)}%`,
      lTrend: lDelta < -5 ? "down" as const : lDelta > 5 ? "up" as const : "neutral" as const,
      lTrendVal: `${lDelta > 0 ? "+" : ""}${lDelta.toFixed(0)}ms`,
      cTrend: cDelta < -0.1 ? "down" as const : cDelta > 0.1 ? "up" as const : "neutral" as const,
      cTrendVal: `${cDelta > 0 ? "+" : ""}$${cDelta.toFixed(2)}`,
      pTrend: passRate >= 0.75 ? "up" as const : passRate >= 0.6 ? "neutral" as const : "down" as const,
      pTrendVal: `${(passRate * 100).toFixed(0)}%`,
    };
  }, [trendData]);

  const totalTokens = MOCK_TOKEN_USAGE.reduce((s, t) => s + t.tokens, 0);
  const totalCalls = MOCK_PROVIDER_CALLS.reduce((s, p) => s + p.calls, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Analytics Dashboard</h2>
          <p className="text-sm text-text-secondary mt-1">
            Evaluation quality, cost, and performance insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "14d", "30d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                timeRange === range
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:bg-surface-hover"
              )}
            >
              {range}
            </button>
          ))}
          <Button variant="ghost" size="sm">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Total Evaluations"
          value={summary.totalEvaluations.toLocaleString()}
          icon={BarChart3}
          trend="up"
          trendValue="+12.4%"
          sparkline={trendData.slice(-10).map((d) => d.faithfulness)}
        />
        <SummaryCard
          label="Avg Faithfulness"
          value={summary.avgFaithfulness.toFixed(3)}
          icon={Activity}
          trend={summary.fTrend}
          trendValue={summary.fTrendVal}
          sparkline={trendData.slice(-10).map((d) => d.faithfulness)}
        />
        <SummaryCard
          label="Avg Latency"
          value={summary.avgLatency.toFixed(0)}
          unit="ms"
          icon={Clock}
          trend={summary.lTrend}
          trendValue={summary.lTrendVal}
          sparkline={trendData.slice(-10).map((d) => d.latency)}
        />
        <SummaryCard
          label="Total Cost"
          value={`$${summary.totalCost.toFixed(2)}`}
          icon={DollarSign}
          trend={summary.cTrend}
          trendValue={summary.cTrendVal}
          sparkline={trendData.slice(-10).map((d) => d.cost)}
        />
        <SummaryCard
          label="Pass Rate"
          value={`${(summary.passRate * 100).toFixed(1)}`}
          unit="%"
          icon={CheckCircle2}
          trend={summary.pTrend}
          trendValue={summary.pTrendVal}
          sparkline={trendData.slice(-10).map((d) => d.faithfulness)}
        />
        <SummaryCard
          label="Active Reviews"
          value={String(summary.activeReviews)}
          icon={AlertTriangle}
          trend="neutral"
        />
      </div>

      {/* Quality Trends */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Quality Trends</h3>
        </div>
        <LineChart
          data={visibleData}
          height={220}
          lines={[
            { key: "faithfulness", color: CHART_COLORS.faithfulness, label: "Faithfulness" },
            { key: "groundedness", color: CHART_COLORS.groundedness, label: "Groundedness" },
            { key: "hallucination", color: CHART_COLORS.hallucination, label: "Hallucination" },
          ]}
          yFormatter={(v) => v.toFixed(2)}
        />
        <div className="flex items-center justify-center gap-5 mt-3">
          {[
            { label: "Faithfulness", color: CHART_COLORS.faithfulness },
            { label: "Groundedness", color: CHART_COLORS.groundedness },
            { label: "Hallucination", color: CHART_COLORS.hallucination },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </Card>

      {/* Cost Trends */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={16} className="text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Daily Cost</h3>
        </div>
        <BarChartSimple
          data={visibleData.map((d) => ({ label: d.date.slice(5), value: d.cost }))}
          height={180}
          color={CHART_COLORS.cost}
          yFormatter={(v) => `$${v.toFixed(1)}`}
        />
      </Card>

      {/* Prompt Improvements & Regression History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prompt Improvements */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Prompt Improvements</h3>
          </div>
          <div className="space-y-3">
            {MOCK_PROMPT_IMPROVEMENTS.map((imp) => (
              <div key={imp.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-text-primary">{imp.promptName}</span>
                    <Badge variant="brand" className="ml-2">{imp.version}</Badge>
                  </div>
                  <span className="text-[11px] text-text-tertiary">{imp.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-text-tertiary">Faithfulness</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-text-secondary">{imp.beforeFaithfulness.toFixed(2)}</span>
                      <ArrowRight size={10} className="text-text-tertiary" />
                      <span className="font-mono text-success font-medium">{imp.afterFaithfulness.toFixed(2)}</span>
                      <span className="text-success">(+{((imp.afterFaithfulness - imp.beforeFaithfulness) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Groundedness</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-text-secondary">{imp.beforeGroundedness.toFixed(2)}</span>
                      <ArrowRight size={10} className="text-text-tertiary" />
                      <span className="font-mono text-success font-medium">{imp.afterGroundedness.toFixed(2)}</span>
                      <span className="text-success">(+{((imp.afterGroundedness - imp.beforeGroundedness) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Regression History */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Regression History</h3>
          </div>
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
                {MOCK_REGRESSIONS.map((reg) => (
                  <tr key={reg.id} className="border-b border-border/50 group">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-text-primary">{reg.metric}</div>
                      <div className="text-text-tertiary mt-0.5 max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible">
                        {reg.description}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={
                          reg.severity === "critical"
                            ? "warning"
                            : reg.severity === "warning"
                            ? "info"
                            : "default"
                        }
                      >
                        {reg.severity}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={
                          reg.status === "resolved"
                            ? "success"
                            : reg.status === "investigating"
                            ? "info"
                            : "default"
                        }
                      >
                        {reg.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className={reg.deltaPercent > 0 ? "text-warning" : "text-success"}>
                        {reg.deltaPercent > 0 ? "+" : ""}{reg.deltaPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right text-text-tertiary">
                      {new Date(reg.detectedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Resource Usage */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Token Usage by Model */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Token Usage by Model</h3>
          </div>
          <PieChartSimple
            segments={MOCK_TOKEN_USAGE.map((t) => ({
              label: t.model,
              value: t.tokens,
              color: t.color,
            }))}
          />
          <div className="mt-3 text-xs text-text-tertiary text-center">
            Total: {totalTokens.toLocaleString()} tokens
          </div>
        </Card>

        {/* API Calls by Provider */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">API Calls by Provider</h3>
          </div>
          <BarChartSimple
            data={MOCK_PROVIDER_CALLS.map((p) => ({ label: p.provider, value: p.calls }))}
            height={160}
            color="#3B82F6"
            yFormatter={(v) => v.toLocaleString()}
          />
          <div className="mt-3 text-xs text-text-tertiary text-center">
            Total: {totalCalls.toLocaleString()} calls
          </div>
        </Card>
      </div>
    </div>
  );
}
