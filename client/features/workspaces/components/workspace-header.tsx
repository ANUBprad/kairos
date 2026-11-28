"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { useAuth } from "@/features/auth";
import { WorkspaceDetail } from "../hooks/use-workspace";
import { useWorkspaces, Workspace } from "../hooks/use-workspaces";
import {
  ChevronDown,
  Layers,
  Check,
  LogOut,
  Brain,
  CreditCard,
  LayoutGrid,
  Puzzle,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import {
  DEVELOPER_ENTITLEMENT_LABEL,
  formatInr,
  MIN_CREDIT_PACK_AMOUNT_INR,
  PremiumAvatar,
  ProBadge,
  useUpgradeModal,
  useUsage,
} from "@/features/billing";
import { UserAvatar } from "@/components/ui/user-avatar";
import { WorkspaceIcon } from "./notebook-icon-picker";



interface WorkspaceHeaderProps {
  workspace: WorkspaceDetail | null;
  sourcesCount: number;
  onUpdateTitle?: (title: string) => Promise<unknown>;
  onUpdateModel?: (model: string) => Promise<unknown>;
}

export function WorkspaceHeader({
  workspace,
  sourcesCount,
  onUpdateModel,
}: WorkspaceHeaderProps) {
  const router = useRouter();
  const { session, logoutMutation } = useAuth();
  const { workspaces } = useWorkspaces();
  const { plan, bypassCredits, bypassFreeQuotas, isDeveloper } = useUsage();

  const { openUpgradeModal } = useUpgradeModal();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const workspaceId = workspace?.id || "";

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Kairos logo + Workspace Switcher Dropdown */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          aria-label="Kairos dashboard"
          title="Go to Dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg"
        >
          <KairosLogo size={22} textSize="text-base" textColor="text-foreground" textClassName="hidden sm:inline" />
        </Link>

        <div className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />

        {/* Workspace Dropdown Switcher */}
        <div className="relative min-w-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex max-w-[140px] items-center gap-1.5 rounded-xl border border-border bg-panel px-2 py-1.5 text-foreground shadow-[var(--shadow-panel)] transition-colors hover:bg-brand-quiet sm:max-w-[240px] sm:gap-2 sm:px-2.5 md:max-w-[320px]"
            title="Switch Workspace"
            aria-expanded={isDropdownOpen}
          >
            <WorkspaceIcon
              value={workspace?.icon}
              size={18}
              className="shrink-0 text-brand"
            />
            <span className="truncate text-xs font-semibold sm:text-sm">
              {workspace?.title || "Untitled Notebook"}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground",
                isDropdownOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="kairos-panel absolute left-0 top-full z-50 mt-2 w-72 animate-fadeIn motion-reduce:animate-none space-y-1 p-2">
              <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Switch Notebook</span>
                <span className="font-mono text-[10px] normal-case tracking-normal">{workspaces.length} total</span>
              </div>

              {/* Workspaces List */}
              <div className="max-h-64 overflow-y-auto space-y-1 py-1">
                {workspaces.map((ws: Workspace) => {
                  const isCurrent = ws.id === workspaceId;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (!isCurrent) {
                          router.push(`/workspace/${ws.id}`);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-xl border border-transparent p-2 text-left text-xs transition-colors",
                        isCurrent
                          ? "border-brand/20 bg-brand-soft font-semibold text-foreground"
                          : "text-foreground hover:bg-brand-quiet"
                      )}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <WorkspaceIcon
                          value={ws.icon}
                          size={16}
                          className="shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">{ws.title}</span>
                      </div>
                      {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              {/* Footer Actions */}
              <div className="space-y-1 border-t border-border pt-1.5">
                {workspaceId && (
                  <Link
                    href={`/workspace/${workspaceId}/settings`}
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
                  >
                    <span>Notebook settings</span>
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Dashboard · All Notebooks</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle/Right Quick Tabs & Controls */}
      <div className="flex items-center gap-2">
        {/* Pro Plan Badge — hidden on small screens to save header space */}
        <ProBadge className="hidden md:inline-flex" />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User profile dropdown button & popover menu */}
        {session?.user && (
          <div className="relative border-l border-border pl-1 sm:pl-2" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title={session.user.name || "User menu"}
              aria-label="Open user menu"
                aria-expanded={isProfileMenuOpen}
            >
              <PremiumAvatar plan={plan} size="sm" className="h-7 w-7">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                  <UserAvatar src={session.user.image} name={session.user.name} />
                </div>
              </PremiumAvatar>
            </button>

            {/* Profile Dropdown Popover Menu */}
            {isProfileMenuOpen && (
              <div className="kairos-panel absolute right-0 top-full z-50 mt-2 w-56 animate-fadeIn motion-reduce:animate-none space-y-1 p-1.5 text-xs">
                {/* Header User Info */}
                <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                  <PremiumAvatar plan={plan} size="md" className="h-8 w-8">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                      <UserAvatar src={session.user.image} name={session.user.name} />
                    </div>
                  </PremiumAvatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {session.user.name || "User"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </div>

                {/* Entitlement / Top Up Credits */}
                <div className="border-b border-border p-1">
                  {isDeveloper || bypassCredits || bypassFreeQuotas ? (
                    <p className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand-quiet px-2.5 py-1.5 text-[11px] font-medium text-brand">
                      {DEVELOPER_ENTITLEMENT_LABEL}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        openUpgradeModal({
                          reason: "Top up your Kairos credits to upload sources, chat, and generate artifacts.",
                        });
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-brand/20 bg-brand-quiet px-2.5 py-1.5 font-medium text-foreground transition-colors hover:bg-brand-soft"
                    >
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                        <span className="text-xs font-semibold">Top Up Credits</span>
                      </div>
                      <span className="kairos-tag font-mono">
                        From {formatInr(MIN_CREDIT_PACK_AMOUNT_INR)}
                      </span>
                    </button>
                  )}
                </div>

                {workspaceId && (
                  <div className="space-y-0.5 pt-1">
                    <Link
                      href={`/workspace/${workspaceId}/sources`}
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 font-medium text-foreground transition-colors hover:bg-brand-soft"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Library</span>
                      </div>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {sourcesCount}
                      </span>
                    </Link>

                    <Link
                      href={`/workspace/${workspaceId}/memory`}
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium text-foreground transition-colors hover:bg-brand-soft"
                    >
                      <Brain className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>Memory</span>
                    </Link>

                    <Link
                      href={`/workspace/${workspaceId}/billing`}
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium text-foreground transition-colors hover:bg-brand-soft"
                    >
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>Credits &amp; billing</span>
                    </Link>

                    <Link
                      href={`/workspace/${workspaceId}/integrations`}
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium text-foreground transition-colors hover:bg-brand-soft"
                    >
                      <Puzzle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>Integrations</span>
                    </Link>
                  </div>
                )}

                {/* Divider & Logout */}
                <div className="border-t border-border pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logoutMutation.mutate();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-medium text-danger transition-colors hover:bg-danger/10"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
