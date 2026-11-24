"use client";

import React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { PremiumAvatar, ProBadge, useUsage } from "@/features/billing";
import { UserAvatar } from "@/components/ui/user-avatar";

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onLogout: () => void;
}

export function DashboardHeader({ user, onLogout }: DashboardHeaderProps) {
  const { plan } = useUsage();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Link
        href="/dashboard"
        aria-label="Kairos dashboard"
        className="flex items-center gap-2 rounded-lg"
      >
        <KairosLogo size={26} textSize="text-xl" textColor="text-foreground" />
      </Link>

      {/* User profile & theme actions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <ProBadge className="hidden md:inline-flex" />

        <ThemeToggle />

        <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        {/* User profile pill */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-panel px-2 py-1 shadow-[var(--shadow-panel)]">
          <PremiumAvatar plan={plan} size="sm" className="h-6 w-6">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
              <UserAvatar src={user.image} name={user.name} />
            </div>
          </PremiumAvatar>

          <span className="hidden max-w-30 truncate text-xs text-muted-foreground sm:inline">
            {user.name || user.email}
          </span>
          <button
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
