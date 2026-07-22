"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  Star,
  Archive,
  GitCompare,
  XCircle,
  Loader2,
  FileText,
  Brain,
  Trash2,
  Copy,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Experiment } from "./types";
import { METRIC_CONFIG, formatMetricValue, getMetricColor, getStatusLabel } from "./types";

interface ExperimentListProps {
  experiments: Experiment[];
  onSelect?: (id: string) => void;
  onCompare?: (ids: string[]) => void;
  onFavorite?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  className?: string;
}

type SortKey = "createdAt" | "name" | "status" | "runtimeMs" | "cost";
type FilterStatus = "all" | "completed" | "running" | "failed" | "draft" | "archived";

export function ExperimentList({
  experiments,
  onSelect,
  onCompare,
  onFavorite,
  onArchive,
  onDelete,
  onDuplicate,
  className,
}: ExperimentListProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = experiments;
    if (filterStatus !== "all") {
      result = result.filter((e) => e.status === filterStatus);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.datasetName.toLowerCase().includes(q) ||
        e.embeddingModel.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      const cmp = sortKey === "name" ? a.name.localeCompare(b.name)
        : sortKey === "status" ? a.status.localeCompare(b.status)
        : sortKey === "runtimeMs" ? (a.runtimeMs ?? 0) - (b.runtimeMs ?? 0)
        : sortKey === "cost" ? (a.cost ?? 0) - (b.cost ?? 0)
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [experiments, filterStatus, search, sortKey, sortAsc]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: experiments.length };
    experiments.forEach((e) => { counts[e.status] = (counts[e.status] || 0) + 1; });
    return counts;
  }, [experiments]);

  const StatusIcon = ({ status }: { status: Experiment["status"] }) => {
    switch (status) {
      case "completed": return <CheckCircle2 size={14} className="text-success" />;
      case "running": return <Loader2 size={14} className="text-brand animate-spin" />;
      case "failed": return <XCircle size={14} className="text-error" />;
      case "draft": return <FileText size={14} className="text-text-tertiary" />;
      default: return <Archive size={14} className="text-text-tertiary" />;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search experiments..."
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
            aria-label="Search experiments"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} aria-label="Toggle filters">
          <Filter size={14} />
        </Button>
        {selectedIds.size >= 2 && (
          <Button variant="primary" size="sm" onClick={() => onCompare?.([...selectedIds])}>
            <GitCompare size={14} />
            Compare ({selectedIds.size})
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter by status">
          {(["all", "completed", "running", "failed", "draft", "archived"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterStatus === s ? "bg-brand/10 text-brand border border-brand/20" : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
              )}
              role="radio"
              aria-checked={filterStatus === s}
            >
              {s === "all" ? "All" : getStatusLabel(s as Experiment["status"])}
              <span className="ml-1 text-text-tertiary">({statusCounts[s] || 0})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <span>{filtered.length} experiment{filtered.length !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>Sort by</span>
        {(["createdAt", "name", "runtimeMs", "cost"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => { setSortKey(key); setSortAsc(sortKey === key ? !sortAsc : false); }}
            className={cn("px-1.5 py-0.5 rounded transition-colors", sortKey === key ? "text-brand bg-brand/10" : "hover:text-text-primary")}
          >
            {key === "createdAt" ? "Date" : key === "name" ? "Name" : key === "runtimeMs" ? "Runtime" : "Cost"}
            {sortKey === key && (sortAsc ? " ↑" : " ↓")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Brain size={40} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-sm text-text-secondary">No experiments found</p>
          <p className="text-xs text-text-tertiary mt-1">
            {search ? "Try a different search term" : "Create your first experiment to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((exp) => (
            <Card
              key={exp.id}
              className={cn(
                "p-4 cursor-pointer transition-all hover:border-brand/30",
                selectedIds.has(exp.id) && "border-brand bg-brand/5"
              )}
              onClick={() => onSelect?.(exp.id)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(exp.id)}
                  onChange={() => toggleSelect(exp.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 rounded border-border"
                  aria-label={`Select ${exp.name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={exp.status} />
                    <h3 className="text-sm font-semibold text-text-primary truncate">{exp.name}</h3>
                    {exp.isFavorite && <Star size={12} className="text-warning fill-warning" />}
                    <Badge variant={exp.status === "completed" ? "success" : exp.status === "running" ? "brand" : exp.status === "failed" ? "warning" : "default"} className="text-[10px]">
                      {getStatusLabel(exp.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-1">{exp.description || "No description"}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-text-tertiary">
                    <span>{exp.datasetName}</span>
                    <span>·</span>
                    <span>{exp.embeddingModel}</span>
                    <span>·</span>
                    <span>{exp.retriever}</span>
                    {exp.runtimeMs !== undefined && (
                      <>
                        <span>·</span>
                        <span>{formatMetricValue(exp.runtimeMs, "duration")}</span>
                      </>
                    )}
                    {exp.cost !== undefined && exp.cost > 0 && (
                      <>
                        <span>·</span>
                        <span>{formatMetricValue(exp.cost, "currency")}</span>
                      </>
                    )}
                  </div>
                  {exp.metrics && (() => {
                    const m = exp.metrics;
                    return (
                      <div className="flex items-center gap-2 mt-2">
                        {(["recallAtK", "mrr", "ndcg", "faithfulness"] as const).map((key) => (
                          <span key={key} className={cn("text-[10px] font-medium", getMetricColor(m[key] as number, METRIC_CONFIG[key].higherIsBetter))}>
                            {METRIC_CONFIG[key].shortLabel}: {((m[key] as number) * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  {exp.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <Tag size={10} className="text-text-tertiary" />
                      {exp.tags.map((tag) => (
                        <span key={tag} className="text-[10px] text-text-tertiary bg-bg rounded px-1.5 py-0.5">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => onFavorite?.(exp.id)} aria-label={exp.isFavorite ? "Unfavorite" : "Favorite"}>
                    <Star size={14} className={exp.isFavorite ? "text-warning fill-warning" : ""} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDuplicate?.(exp.id)} aria-label="Duplicate">
                    <Copy size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onArchive?.(exp.id)} aria-label="Archive">
                    <Archive size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete?.(exp.id)} aria-label="Delete">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
