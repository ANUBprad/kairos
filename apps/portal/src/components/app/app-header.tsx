"use client";

import { Search } from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { NotificationCenter } from "@/components/enterprise/notification-center";

interface AppHeaderProps {
  email: string;
  name: string | null;
  image: string | null;
  organizationName: string | null;
}

export function AppHeader({ email, name, image, organizationName }: AppHeaderProps) {
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
        <NotificationCenter />

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
