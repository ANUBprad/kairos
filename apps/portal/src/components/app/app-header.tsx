"use client";

import { Bell, Search } from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { Breadcrumbs } from "@/components/app/breadcrumbs";

interface AppHeaderProps {
  email: string;
  name: string | null;
  image: string | null;
  organizationName: string | null;
}

export function AppHeader({ email, name, image, organizationName }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b border-border bg-bg/80 px-4 sm:px-6 backdrop-blur-md">
      <div className="flex-1 min-w-0 overflow-hidden">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
            );
          }}
          className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-2 rounded border border-border bg-bg px-1 py-0.5 text-[9px] font-mono">
            Ctrl+K
          </kbd>
        </button>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
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
