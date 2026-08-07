"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  FlaskConical,
  MessageSquare,
  BarChart3,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "experiment" | "upload" | "evaluation" | "chat" | "chunking" | "embedding" | "indexing";
  title: string;
  description?: string;
  timestamp: string;
  status?: "running" | "completed" | "failed" | "queued";
  href?: string;
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
  upload: { icon: Upload, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  experiment: { icon: FlaskConical, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  evaluation: { icon: BarChart3, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  chat: { icon: MessageSquare, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  chunking: { icon: FileText, color: "text-teal-500", bgColor: "bg-teal-500/10" },
  embedding: { icon: FolderOpen, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  indexing: { icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/10" },
};

const STATUS_CONFIG: Record<string, { icon: LucideIcon; color: string }> = {
  running: { icon: Loader2, color: "text-info" },
  completed: { icon: CheckCircle2, color: "text-success" },
  failed: { icon: AlertCircle, color: "text-error" },
  queued: { icon: Clock, color: "text-text-tertiary" },
};

function formatTimestamp(ts: string): string {
  const now = new Date();
  const date = new Date(ts);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ActivityFeedProps {
  items?: ActivityItem[];
  maxItems?: number;
  className?: string;
}

const DEMO_ACTIVITIES: ActivityItem[] = [
  {
    id: "1",
    type: "upload",
    title: "Research Paper.pdf uploaded",
    description: "Added to Knowledge Base",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    status: "completed",
    href: "/app/knowledge-bases",
  },
  {
    id: "2",
    type: "chunking",
    title: "Chunking completed",
    description: "247 chunks generated",
    timestamp: new Date(Date.now() - 600000).toISOString(),
    status: "completed",
  },
  {
    id: "3",
    type: "embedding",
    title: "Embeddings generated",
    description: "text-embedding-3-small",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    status: "completed",
  },
  {
    id: "4",
    type: "experiment",
    title: "Hybrid Retrieval Test",
    description: "Running evaluation",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    status: "running",
    href: "/app/experiments",
  },
  {
    id: "5",
    type: "chat",
    title: "RAG Chat session",
    description: "5 questions answered",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: "completed",
    href: "/app/rag-chat",
  },
];

function ActivityFeedItem({ item }: { item: ActivityItem }) {
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.upload;
  const statusConfig = item.status ? STATUS_CONFIG[item.status] : null;
  const Icon = typeConfig.icon;
  const StatusIcon = statusConfig?.icon;

  const content = (
    <div className="flex items-start gap-3 group">
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] shrink-0 mt-0.5",
        typeConfig.bgColor
      )}>
        <Icon size={14} className={typeConfig.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
          {StatusIcon && (
            <StatusIcon
              size={12}
              className={cn(statusConfig?.color, item.status === "running" && "animate-spin")}
            />
          )}
        </div>
        {item.description && (
          <p className="text-xs text-text-tertiary truncate mt-0.5">{item.description}</p>
        )}
      </div>
      <span className="text-[11px] text-text-tertiary whitespace-nowrap shrink-0">
        {formatTimestamp(item.timestamp)}
      </span>
    </div>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="block rounded-[var(--radius-md)] p-2.5 -mx-1 transition-colors hover:bg-surface-hover/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] p-2.5 -mx-1">
      {content}
    </div>
  );
}

function ActivityFeed({ items, maxItems = 8, className }: ActivityFeedProps) {
  const [activityItems, setActivityItems] = useState<ActivityItem[]>(items || []);
  const [isUsingDemo, setIsUsingDemo] = useState(!items || items.length === 0);

  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem("kairos_workspace_recentActivity");
      if (stored) {
        const parsed = JSON.parse(stored) as ActivityItem[];
        if (parsed.length > 0) {
          setActivityItems(parsed);
          setIsUsingDemo(false);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) {
      loadFromStorage();
    }
  }, [items, loadFromStorage]);

  const displayItems = (isUsingDemo && (!activityItems || activityItems.length === 0) ? DEMO_ACTIVITIES : activityItems).slice(0, maxItems);

  return (
    <div className={cn("space-y-1", className)}>
      {displayItems.map((item) => (
        <ActivityFeedItem key={item.id} item={item} />
      ))}
      {displayItems.length === 0 && (
        <div className="py-8 text-center">
          <Clock size={24} className="mx-auto text-text-tertiary mb-2" />
          <p className="text-sm text-text-tertiary">No recent activity</p>
        </div>
      )}
    </div>
  );
}

export { ActivityFeed };
export type { ActivityItem, ActivityFeedProps };
