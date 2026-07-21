"use client";

import { useState } from "react";
import {
  Search,
  Bell,
} from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { Breadcrumbs } from "@/components/app/breadcrumbs";

interface AppHeaderProps {
  email: string;
  name: string | null;
  image: string | null;
  organizationName: string | null;
}

export function AppHeader({ email, name, image, organizationName }: AppHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b border-border bg-bg/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Breadcrumbs */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <Breadcrumbs />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Search / Command Palette Trigger */}
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
            );
          }}
          className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
          aria-label="Search and commands (Ctrl+K)"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-1 hidden sm:inline rounded border border-border bg-bg px-1 py-0.5 text-[9px] font-mono">
            Ctrl+K
          </kbd>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
          </button>

          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-semibold text-text-primary">Notifications</span>
                  <span className="text-[10px] text-text-tertiary">No new notifications</span>
                </div>
                <div className="p-8 text-center">
                  <Bell size={24} className="mx-auto text-text-tertiary mb-2" />
                  <p className="text-sm text-text-tertiary">All caught up!</p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Activity from your research will appear here.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Keyboard shortcut hint */}
        <div className="hidden lg:flex items-center gap-1.5 ml-1">
          <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 text-[9px] font-mono text-text-tertiary">
            U
          </kbd>
          <span className="text-[9px] text-text-tertiary">Upload</span>
        </div>

        {/* User Menu */}
        <UserMenu
          email={email}
          name={name}
          image={image}
          organizationName={organizationName}
        />
      </div>
    </header>
  );
}
