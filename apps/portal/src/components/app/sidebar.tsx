"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Code2,
  Bot,
  BarChart3,
  SlidersHorizontal,
  GitBranch,
  BookOpen,
  Microscope,
  GraduationCap,
  Eye,
  Search,
  Lightbulb,
  Sparkles,
  FlaskConical,
  NotebookPen,
  FileText,
  ChevronDown,
  Command,
  Menu,
  X,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

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
  userEmail: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Research",
    items: [
      { label: "Overview", href: "/app", icon: LayoutDashboard },
      { label: "Research Dashboard", href: "/app/research", icon: Microscope },
      { label: "AI Copilot", href: "/app/copilot", icon: Sparkles },
      { label: "Notebook", href: "/app/notebook", icon: NotebookPen, badge: "New" },
      { label: "Experiment Lineage", href: "/app/lineage", icon: GitBranch },
      { label: "Experiment Planner", href: "/app/planner", icon: Lightbulb },
      { label: "Publication", href: "/app/publication", icon: FileText, badge: "New" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Document Repository", href: "/app/knowledge-bases", icon: FolderOpen },
      { label: "Chunking Studio", href: "/app/chunking-studio", icon: Code2 },
      { label: "Experiment Builder", href: "/app/experiment-builder", icon: FlaskConical, badge: "New" },
    ],
  },
  {
    label: "Evaluate",
    items: [
      { label: "Retrieval Lab", href: "/app/retrieval-lab", icon: Search },
      { label: "Advanced Retrieval", href: "/app/advanced-retrieval", icon: GitBranch },
      { label: "Evaluation", href: "/app/evaluation", icon: BarChart3 },
      { label: "Benchmark Explorer", href: "/app/benchmark-explorer", icon: FlaskConical, badge: "New" },
    ],
  },
  {
    label: "Explain",
    items: [
      { label: "RAG Chat", href: "/app/rag-chat", icon: Bot },
      { label: "Retrieval Debugger", href: "/app/rag-chat#debug", icon: Eye },
    ],
  },
  {
    label: "Learn",
    items: [
      { label: "Architecture", href: "/app/architecture", icon: BookOpen },
      { label: "Project Guide", href: "/app/project-guide", icon: GraduationCap },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Configuration", href: "/app/settings", icon: SlidersHorizontal },
      { label: "Account", href: "/app/account", icon: User },
    ],
  },
];

export function AppSidebar({ organization }: SidebarProps) {
  const pathname = usePathname();
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
        >
          <Command size={10} />
          K
        </button>
      </div>

      {organization && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary/60 mb-1">
            Project
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
              <Link
                href="/app/copilot"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <Sparkles size={12} />
                Ask Copilot
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        <nav className="space-y-5">
          {navSections.map((section) => (
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
