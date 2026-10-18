"use client";

import { Menu, Search } from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { NotificationCenter } from "@/components/enterprise/notification-center";
import { APP_SIDEBAR_OPEN_EVENT } from "@/lib/app-nav";

interface AppHeaderProps {
  email: string;
  name: string | null;
  image: string | null;
  organizationName: string | null;
  isAnonymous: boolean;
}

export function AppHeader({ email, name, image, organizationName, isAnonymous }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
      <button
        onClick={() => window.dispatchEvent(new Event(APP_SIDEBAR_OPEN_EVENT))}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <Breadcrumbs />
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
          className="flex h-9 items-center gap-2 rounded-md border border-border px-2.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          aria-label="Search and commands (Ctrl+K)"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-0.5 hidden rounded border border-border bg-bg px-1 py-0.5 font-mono text-[9px] text-text-tertiary sm:inline">
            Ctrl K
          </kbd>
        </button>

        <NotificationCenter />

        <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

        <UserMenu
          email={email}
          name={name}
          image={image}
          organizationName={organizationName}
          isAnonymous={isAnonymous}
        />
      </div>
    </header>
  );
}
