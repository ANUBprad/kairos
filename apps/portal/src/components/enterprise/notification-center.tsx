"use client";

import { useState, useEffect } from "react";
import { Bell, Check, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  removeNotification,
  clearAllNotifications,
} from "@/lib/actions/notification";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface NotificationCenterProps {
  className?: string;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  "experiment.completed": "✓",
  "experiment.failed": "✗",
  "upload.completed": "✓",
  "upload.failed": "✗",
  "evaluation.completed": "✓",
  "invitation.received": "✉",
  "permission.updated": "👤",
  "api_key.rotated": "🔑",
  "member.joined": "👋",
  "member.removed": "🚪",
  "settings.updated": "⚙",
  "system.update": "🔔",
};

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadNotifications = async (reset = false) => {
    setIsLoading(true);
    try {
      const result = await listNotifications({
        limit: 10,
        offset: reset ? 0 : page * 10,
      });

      if (result.success && "notifications" in result) {
        if (reset) {
          setNotifications(result.notifications);
          setPage(1);
        } else {
          setNotifications((prev) => [...prev, ...result.notifications]);
          setPage((p) => p + 1);
        }
        setUnreadCount(result.unreadCount);
        setHasMore(result.notifications.length === 10);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications(true);
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleRemove = async (id: string) => {
    await removeNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => {
      const wasUnread = notifications.find((n) => n.id === id && !n.read);
      return wasUnread ? Math.max(0, prev - 1) : prev;
    });
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[500px] z-50 rounded-xl border border-border bg-surface shadow-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-text-primary">
                Notifications
              </span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-brand hover:text-brand/80 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-text-tertiary hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={24} className="mx-auto text-text-tertiary mb-2" />
                  <p className="text-sm text-text-tertiary">All caught up!</p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Activity from your research will appear here.
                  </p>
                </div>
              ) : (
                <>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-surface-hover transition-colors",
                        !notification.read && "bg-brand/5"
                      )}
                    >
                      <span className="text-lg mt-0.5">
                        {NOTIFICATION_ICONS[notification.type] || "🔔"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-brand shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <span className="text-[10px] text-text-tertiary mt-1 block">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1 text-text-tertiary hover:text-text-secondary rounded"
                            title="Mark as read"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(notification.id)}
                          className="p-1 text-text-tertiary hover:text-error rounded"
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Load More */}
                  {hasMore && (
                    <button
                      onClick={() => loadNotifications(false)}
                      disabled={isLoading}
                      className="w-full py-3 text-xs text-brand hover:text-brand/80 disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? "Loading..." : "Load more"}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-border px-4 py-2">
                <button
                  onClick={handleClearAll}
                  className="text-xs text-text-tertiary hover:text-error transition-colors"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
