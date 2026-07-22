"use client";

import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  Scissors,
  Cpu,
  Pencil,
  Trash2,
  RefreshCw,
  MessageSquare,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DocumentActivity } from "./types";
import { formatTimestamp } from "./utils";

interface ActivityTimelineProps {
  activities: DocumentActivity[];
  className?: string;
}

const ACTION_CONFIG: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
  UPLOADED: { icon: Upload, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  PROCESSED: { icon: FileText, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  CHUNKED: { icon: Scissors, color: "text-teal-500", bgColor: "bg-teal-500/10" },
  EMBEDDED: { icon: Cpu, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  RENAMED: { icon: Pencil, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  DELETED: { icon: Trash2, color: "text-error", bgColor: "bg-error/10" },
  REPROCESSED: { icon: RefreshCw, color: "text-brand", bgColor: "bg-brand/10" },
  CHATTED: { icon: MessageSquare, color: "text-green-500", bgColor: "bg-green-500/10" },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action.toUpperCase()] || {
    icon: Clock,
    color: "text-text-tertiary",
    bgColor: "bg-surface-hover",
  };
}

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <Clock size={24} className="mx-auto text-text-tertiary mb-2" />
        <p className="text-sm text-text-tertiary">No activity yet</p>
        <p className="text-xs text-text-tertiary mt-1">Activity will appear as the document is processed</p>
      </div>
    );
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className={cn("space-y-3", className)}>
      <span className="text-sm font-medium text-text-primary">
        {activities.length} event{activities.length !== 1 ? "s" : ""}
      </span>

      <div className="space-y-0">
        {sorted.map((activity, i) => {
          const config = getActionConfig(activity.action);
          const Icon = config.icon;

          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  config.bgColor
                )}>
                  <Icon size={12} className={config.color} />
                </div>
                {i < sorted.length - 1 && (
                  <div className="w-0.5 h-5 my-1 bg-border" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {activity.action.charAt(0) + activity.action.slice(1).toLowerCase()}
                  </span>
                  <span className="text-[11px] text-text-tertiary">
                    {formatTimestamp(activity.createdAt)}
                  </span>
                </div>
                {activity.user && (
                  <p className="text-xs text-text-tertiary mt-0.5">
                    by {activity.user.name || "Unknown"}
                  </p>
                )}
                {activity.details && Object.keys(activity.details).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {Object.entries(activity.details).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-[10px] text-text-tertiary"
                      >
                        <span className="font-medium">{key}:</span>
                        <span className="font-mono">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
