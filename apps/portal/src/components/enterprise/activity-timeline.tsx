"use client";

import { cn } from "@/lib/utils";

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

interface ActivityTimelineProps {
  activities: AuditLogEntry[];
  className?: string;
}

const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Created organization",
  "organization.updated": "Updated organization settings",
  "member.joined": "Joined organization",
  "member.role_updated": "Updated member role",
  "member.removed": "Removed member",
  "invitation.sent": "Sent invitation",
  "invitation.accepted": "Accepted invitation",
  "invitation.revoked": "Revoked invitation",
  "share_link.created": "Created share link",
  "share_link.revoked": "Revoked share link",
  "api_key.created": "Created API key",
  "api_key.disabled": "Disabled API key",
  "api_key.deleted": "Deleted API key",
  "api_key.rotated": "Rotated API key",
  "experiment.created": "Created experiment",
  "experiment.completed": "Experiment completed",
  "experiment.failed": "Experiment failed",
  "upload.completed": "Upload completed",
  "upload.failed": "Upload failed",
};

const ACTION_ICONS: Record<string, string> = {
  "organization.created": "🏢",
  "organization.updated": "⚙",
  "member.joined": "👋",
  "member.role_updated": "👤",
  "member.removed": "🚪",
  "invitation.sent": "✉",
  "invitation.accepted": "✓",
  "invitation.revoked": "✗",
  "share_link.created": "🔗",
  "share_link.revoked": "🔓",
  "api_key.created": "🔑",
  "api_key.disabled": "🔒",
  "api_key.deleted": "🗑",
  "api_key.rotated": "↻",
  "experiment.created": "🧪",
  "experiment.completed": "✓",
  "experiment.failed": "✗",
  "upload.completed": "📄",
  "upload.failed": "✗",
};

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const formatDetails = (details: Record<string, unknown> | null) => {
    if (!details) return null;

    const parts: string[] = [];
    if (details.oldRole && details.newRole) {
      parts.push(`${details.oldRole} → ${details.newRole}`);
    }
    if (details.email) {
      parts.push(details.email as string);
    }
    if (details.role) {
      parts.push(details.role as string);
    }
    if (details.name) {
      parts.push(details.name as string);
    }

    return parts.length > 0 ? parts.join(" · ") : null;
  };

  if (activities.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-sm text-text-tertiary">No activity yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          className="relative flex items-start gap-3 pb-4"
        >
          {/* Timeline line */}
          {index < activities.length - 1 && (
            <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
          )}

          {/* Icon */}
          <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface border border-border text-sm shrink-0">
            {ACTION_ICONS[activity.action] || "📋"}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {activity.user.name || activity.user.email}
              </span>
              <span className="text-xs text-text-tertiary">
                {ACTION_LABELS[activity.action] || activity.action}
              </span>
            </div>
            {formatDetails(activity.details) && (
              <p className="text-xs text-text-tertiary mt-0.5">
                {formatDetails(activity.details)}
              </p>
            )}
            <span className="text-[10px] text-text-tertiary mt-1 block">
              {formatDate(activity.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
