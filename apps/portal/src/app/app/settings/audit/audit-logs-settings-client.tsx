"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ActivityTimeline } from "@/components/enterprise/activity-timeline";
import {
  listAuditLogs,
  getAuditLogStats,
  exportAuditLogs,
} from "@/lib/actions/audit";
interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface AuditStats {
  today: number;
  week: number;
  month: number;
  total: number;
  topActions: { action: string; count: number }[];
}

export function AuditLogsSettingsClient() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsResult, statsResult] = await Promise.all([
        listAuditLogs("demo-org", { limit: 20, offset: 0, action: filter || undefined }),
        getAuditLogStats("demo-org"),
      ]);

      if (logsResult.success && "logs" in logsResult) {
        setLogs(logsResult.logs || []);
        setHasMore((logsResult.logs || []).length === 20);
      }
      if (statsResult.success && "stats" in statsResult) {
        setStats(statsResult.stats || null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    const result = await listAuditLogs("demo-org", {
      limit: 20,
      offset: nextPage * 20,
      action: filter || undefined,
    });

    if (result.success && "logs" in result && result.logs) {
      const newLogs = result.logs as AuditLogEntry[];
      setLogs((prev) => [...prev, ...newLogs]);
      setPage(nextPage);
      setHasMore(newLogs.length === 20);
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);
    try {
      const result = await exportAuditLogs("demo-org", { format });
      if (result.success && result.data) {
        const blob = new Blob(
          [typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)],
          { type: format === "csv" ? "text/csv" : "application/json" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Track all activity in your organization."
        purpose="Monitor user actions and system events."
        relatedPages={[
          { label: "Security", href: "/app/settings/security" },
          { label: "Members", href: "/app/settings/members" },
        ]}
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary">Today</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {stats.today}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary">This Week</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {stats.week}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary">This Month</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {stats.month}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary">Total</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {stats.total}
            </p>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Activity Timeline
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
                loadData();
              }}
              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="">All Actions</option>
              <option value="member.joined">Member Joined</option>
              <option value="member.role_updated">Role Updated</option>
              <option value="share_link.created">Share Link Created</option>
              <option value="api_key.created">API Key Created</option>
            </select>

            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-hover transition-colors"
            >
              {exporting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              Export CSV
            </button>

            <button
              onClick={() => handleExport("json")}
              disabled={exporting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-hover transition-colors"
            >
              {exporting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              Export JSON
            </button>
          </div>
        </div>

        <ActivityTimeline activities={logs} />

        {hasMore && (
          <button
            onClick={loadMore}
            className="w-full mt-4 py-2 text-xs text-brand hover:text-brand/80 transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
