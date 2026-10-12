"use client";

import { useState } from "react";
import { ArrowUpDown, BarChart3, ChevronLeft, ChevronRight, Trophy, Medal, Award, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A ranked view over real, completed benchmark runs. Every number here comes
// from a run's persisted aggregatedMetrics; nothing is synthesized.
export interface LeaderboardRowEntry {
  rank: number;
  name: string;
  workspaceName: string | null;
  overallScore: number;
  recallAtK: number;
  precisionAtK: number;
  hitRate: number;
  mrr: number;
  ndcg: number;
  faithfulness: number | null;
  latencyMs: number;
}

type SortKey = "overallScore" | "recallAtK" | "mrr" | "ndcg" | "latencyMs";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "overallScore", label: "Overall Score" },
  { key: "recallAtK", label: "Recall@K" },
  { key: "mrr", label: "MRR" },
  { key: "ndcg", label: "nDCG" },
  { key: "latencyMs", label: "Latency" },
];

const METRICS: { key: keyof LeaderboardRowEntry; label: string; format: (v: number) => string }[] = [
  { key: "recallAtK", label: "Recall@K", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "precisionAtK", label: "Precision@K", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "mrr", label: "MRR", format: (v) => v.toFixed(3) },
  { key: "ndcg", label: "nDCG", format: (v) => v.toFixed(3) },
  { key: "latencyMs", label: "Latency", format: (v) => `${Math.round(v)}ms` },
];

const ITEMS_PER_PAGE = 8;

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

export function Leaderboards({ entries }: { entries: LeaderboardRowEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("overallScore");
  const [currentPage, setCurrentPage] = useState(1);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface/40 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
          <Inbox size={26} className="text-brand" />
        </div>
        <h2 className="mt-5 text-base font-semibold text-text-primary">No completed benchmark runs</h2>
        <p className="mt-2 max-w-sm text-sm text-text-secondary">
          Leaderboards rank your finished benchmark runs. Run a benchmark from Evaluation to
          populate this view.
        </p>
        <Button variant="primary" className="mt-6" asChild>
          <a href="/app/evaluation">Open Evaluation</a>
        </Button>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (sortKey === "latencyMs") return a.latencyMs - b.latencyMs;
    return (b[sortKey] as number) - (a[sortKey] as number);
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const maxScore = Math.max(...sorted.map((e) => e.overallScore), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand/10">
            <BarChart3 size={20} className="text-brand" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Benchmark Leaderboard</h2>
            <p className="text-[13px] text-text-tertiary">
              {entries.length} completed run{entries.length !== 1 ? "s" : ""} ranked by overall score
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-text-tertiary" />
          <select
            value={sortKey}
            onChange={(e) => { setSortKey(e.target.value as SortKey); setCurrentPage(1); }}
            className="appearance-none bg-surface-hover border border-border rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary cursor-pointer hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2.5 bg-surface-hover border-b border-border">
          <div className="w-12 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Rank</div>
          <div className="w-20 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Tier</div>
          <div className="flex-1 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Run / Score</div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Metrics</div>
        </div>

        <div className="divide-y divide-border/50">
          {paginated.map((entry) => {
            const tier = entry.rank <= 3 ? entry.rank : null;
            const scorePercentage = (entry.overallScore / maxScore) * 100;
            return (
              <div key={`${entry.rank}-${entry.name}`} className="group flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
                <div className="w-12 flex-shrink-0">
                  <span className="text-sm font-bold text-text-primary tabular-nums">#{entry.rank}</span>
                </div>
                <div className="w-20 flex-shrink-0">{tier ? getTierBadge(tier) : null}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">{entry.name}</span>
                    {entry.workspaceName && (
                      <span className="text-[11px] text-text-tertiary truncate">{entry.workspaceName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden max-w-[200px]">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", getScoreColor(entry.overallScore))}
                        style={{ width: `${scorePercentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-text-primary tabular-nums">
                      {entry.overallScore.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  {METRICS.map((metric) => (
                    <span
                      key={metric.key as string}
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface text-text-secondary border-border"
                    >
                      {metric.label}: {metric.format(entry[metric.key] as number)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-[12px] text-text-tertiary">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage(page - 1)} disabled={page === 1}>
              <ChevronLeft size={14} />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === page ? "primary" : "ghost"}
                size="sm"
                onClick={() => setCurrentPage(p)}
                className="min-w-[32px]"
              >
                {p}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage(page + 1)} disabled={page === totalPages}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}