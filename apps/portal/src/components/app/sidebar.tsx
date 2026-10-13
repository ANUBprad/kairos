"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Command, X, Check, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useTransition } from "react";
import { switchWorkspaceOrganization } from "@/lib/actions/organization";
import { APP_NAV, APP_SIDEBAR_OPEN_EVENT } from "@/lib/app-nav";

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

export function AppSidebar({ organization, organizations }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      APP_NAV.filter((section) => section.defaultCollapsed).map((section) => [section.label, true])
    )
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function openSidebar() {
      setMobileMenuOpen(true);
    }
    window.addEventListener(APP_SIDEBAR_OPEN_EVENT, openSidebar);
    return () => window.removeEventListener(APP_SIDEBAR_OPEN_EVENT, openSidebar);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  function handleSwitchOrganization(organizationId: string) {
    startTransition(async () => {
      await switchWorkspaceOrganization(organizationId);
      setWorkspaceMenuOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Application sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out md:relative md:z-auto md:translate-x-0",
          mobileMenuOpen ? "translate-x-0 shadow-xl md:shadow-none" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Kairos home">
            <Image
              src="/kai.png"
              alt=""
              width={26}
              height={26}
              priority
              className="object-contain"
            />
            <span className="text-[15px] font-semibold tracking-tight text-text-primary">
              Kairos
            </span>
          </Link>
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
            }}
            className="ml-auto hidden items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary md:flex"
            aria-label="Open command palette"
          >
            <Command size={11} />
            K
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="-mr-1.5 ml-auto flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary md:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {organization && (
          <div className="shrink-0 border-b border-border px-3 py-3">
            <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Workspace
            </p>
            <button
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              aria-expanded={workspaceMenuOpen}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
            >
              <span className="truncate text-sm font-medium text-text-primary">
                {organization.name}
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "shrink-0 text-text-tertiary transition-transform",
                  workspaceMenuOpen && "rotate-180"
                )}
              />
            </button>
            {workspaceMenuOpen && (
              <div className="mt-1 rounded-md border border-border bg-bg/60 p-1.5">
                {organizations.length > 1 && (
                  <div className="mb-1">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
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
                            ? "bg-brand-muted text-brand"
                            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                        )}
                      >
                        <span className="flex-1 truncate text-left">{org.name}</span>
                        {org.id === organization.id && <Check size={12} className="shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Quick Actions
                </p>
                <Link
                  href="/app/knowledge-bases"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <Plus size={12} />
                  New workspace
                </Link>
                <Link
                  href="/app/studio"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <Sparkles size={12} />
                  Open Studio
                </Link>
              </div>
            )}
          </div>
        )}

        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="space-y-6">
            {APP_NAV.map((section) => {
              const sectionHasActive = section.items.some((item) =>
                item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
              );
              const isCollapsed =
                Boolean(collapsedSections[section.label]) && !sectionHasActive;
              return (
                <div key={section.label}>
                  {section.defaultCollapsed ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          [section.label]: !prev[section.label],
                        }))
                      }
                      aria-expanded={!isCollapsed}
                      className="flex w-full items-center justify-between px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary transition-colors hover:text-text-secondary"
                    >
                      {section.label}
                      <ChevronDown
                        size={12}
                        className={cn("transition-transform", !isCollapsed && "rotate-180")}
                      />
                    </button>
                  ) : (
                    <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                      {section.label}
                    </p>
                  )}
                  {!isCollapsed && (
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
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-brand-muted font-medium text-brand"
                                : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                            )}
                          >
                            {isActive && (
                              <span
                                className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand"
                                aria-hidden="true"
                              />
                            )}
                            <Icon
                              size={17}
                              className={cn(
                                "shrink-0 transition-colors",
                                isActive
                                  ? "text-brand"
                                  : "text-text-tertiary group-hover:text-text-secondary"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="flex items-center justify-center gap-1.5 text-[10px] text-text-tertiary">
            <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono">Ctrl</kbd>
            <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono">K</kbd>
            <span>Quick search</span>
          </p>
        </div>
      </aside>
    </>
  );
}
