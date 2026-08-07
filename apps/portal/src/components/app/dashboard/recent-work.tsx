"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  FileText,
  FlaskConical,
  BarChart3,
  MessageSquare,
  ArrowRight,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface RecentItem {
  id: string;
  type: "kb" | "document" | "experiment" | "benchmark" | "chat";
  name: string;
  description?: string;
  timestamp?: string;
  href: string;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  kb: FolderOpen,
  document: FileText,
  experiment: FlaskConical,
  benchmark: BarChart3,
  chat: MessageSquare,
};

const TYPE_COLORS: Record<string, string> = {
  kb: "text-blue-500 bg-blue-500/10",
  document: "text-emerald-500 bg-emerald-500/10",
  experiment: "text-purple-500 bg-purple-500/10",
  benchmark: "text-violet-500 bg-violet-500/10",
  chat: "text-teal-500 bg-teal-500/10",
};

function RecentItemRow({ item }: { item: RecentItem }) {
  const Icon = TYPE_ICONS[item.type] || FileText;
  const colorClass = TYPE_COLORS[item.type] || "text-text-tertiary bg-surface-hover";

  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-[var(--radius-md)] p-2.5 -mx-1 transition-colors hover:bg-surface-hover/50 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] shrink-0", colorClass)}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate group-hover:text-brand transition-colors">
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-text-tertiary truncate">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.timestamp && (
          <span className="text-[11px] text-text-tertiary flex items-center gap-1">
            <Clock size={10} />
            {item.timestamp}
          </span>
        )}
        <ArrowRight size={12} className="text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </div>
    </Link>
  );
}

interface RecentWorkProps {
  items?: RecentItem[];
  title?: string;
  maxItems?: number;
  viewAllHref?: string;
  className?: string;
}

function RecentWork({
  items = [],
  maxItems = 6,
  className,
}: RecentWorkProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className={cn("space-y-1", className)}>
      {displayItems.map((item) => (
        <RecentItemRow key={item.id} item={item} />
      ))}
      {displayItems.length === 0 && (
        <div className="py-8 text-center">
          <Clock size={24} className="mx-auto text-text-tertiary mb-2" />
          <p className="text-sm text-text-tertiary">No recent work</p>
        </div>
      )}
    </div>
  );
}

export { RecentWork };
export type { RecentItem, RecentWorkProps };
