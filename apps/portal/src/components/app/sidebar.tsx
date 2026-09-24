"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Command,
  Menu,
  X,
  Check,
  FlaskConical,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useTransition } from "react";
import { switchWorkspaceOrganization } from "@/lib/actions/organization";
import { APP_NAV, type AppNavSection } from "@/lib/app-nav";

interface SidebarProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    projects: {
      id: string;
      name: string;
      _count: { knowledgeBases: number };
    }[];
  } | null;
  organizations: {
    id: string;
    name: string;
    slug: string;
  }[];
}

type NavSection = AppNavSection;

export function AppSidebar({ organization, organizations }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  function handleSwitchOrganization(organizationId: string) {
    startTransition(async () => {
      await switchWorkspaceOrganization(organizationId);
      setExperimentOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface md:hidden"
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-border bg-surface transition-transform duration-200 md:relative md:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="flex h-14 items-center gap-3 border-b border-border px-5">
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Kairos home">
          <Image
            src="/kai.png"
            alt="Kairos"
            width={28}
            height={28}
            priority
            className="object-contain"
          />
          <span className="text-sm font-semibold text-text-primary">Kairos</span>
        </Link>
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[10px] text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
          aria-label="Open command palette"
        >
          <Command size={10} />
          K
        </button>
      </div>

      {organization && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary/60 mb-1">
            Workspace
          </p>
          <button
            onClick={() => setExperimentOpen(!experimentOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-bg/50 px-3 py-2 hover:bg-surface-hover transition-colors"
          >
            <span className="truncate text-sm font-medium text-text-primary">
              {organization.name}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 text-text-tertiary transition-transform",
                experimentOpen && "rotate-180"
              )}
            />
          </button>
          {experimentOpen && (
            <div className="mt-2 rounded-lg border border-border bg-bg/50 p-2">
              {organizations.length > 1 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary/60">
                    Switch workspace
                  </p>
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrganization(org.id)}
                      disabled={org.id === organization.id || isPending}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                        org.id === organization.id
                          ? "bg-brand/10 text-brand"
                          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                      )}
                    >
                      <span className="flex-1 truncate text-left">{org.name}</span>
                      {org.id === organization.id && <Check size={12} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary/60">
                Quick Actions
              </p>
              <Link
                href="/app/experiment-builder"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <FlaskConical size={12} />
                New Experiment
              </Link>
              <Link
                href="/app/evaluation"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <BarChart3 size={12} />
                View Benchmarks
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        <nav className="space-y-5" role="navigation" aria-label="Main navigation">
          {APP_NAV.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary/60">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/app"
                      ? pathname === "/app"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-brand/10 text-brand"
                          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn(
                          "transition-colors duration-150",
                          isActive ? "text-brand" : "text-text-tertiary group-hover:text-text-secondary"
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-border p-3">
        <p className="text-[10px] text-text-tertiary text-center">
          <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono">Ctrl+K</kbd>{" "}
          Quick search
        </p>
      </div>
    </aside>
    </>
  );
}
