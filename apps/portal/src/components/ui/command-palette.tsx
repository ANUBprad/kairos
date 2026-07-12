"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Microscope,
  Sparkles,
  GitBranch,
  Lightbulb,
  FolderOpen,
  Code2,
  BarChart3,
  Bot,
  Eye,
  BookOpen,
  GraduationCap,
  SlidersHorizontal,
  FileText,
  FlaskConical,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  category: string;
  keywords: string[];
}

const COMMANDS: CommandItem[] = [
  { id: "overview", label: "Overview", href: "/app", icon: LayoutDashboard, category: "Navigation", keywords: ["dashboard", "home", "overview"] },
  { id: "research", label: "Research Dashboard", href: "/app/research", icon: Microscope, category: "Research", keywords: ["research", "dashboard", "metrics", "analysis"] },
  { id: "copilot", label: "AI Copilot", href: "/app/copilot", icon: Sparkles, category: "Research", keywords: ["copilot", "ai", "assistant", "recommendations"] },
  { id: "lineage", label: "Experiment Lineage", href: "/app/lineage", icon: GitBranch, category: "Research", keywords: ["lineage", "history", "versions", "provenance"] },
  { id: "planner", label: "Experiment Planner", href: "/app/planner", icon: Lightbulb, category: "Research", keywords: ["planner", "plan", "experiment", "suggest"] },
  { id: "documents", label: "Document Repository", href: "/app/knowledge-bases", icon: FolderOpen, category: "Build", keywords: ["documents", "knowledge", "base", "upload"] },
  { id: "chunking", label: "Chunking Studio", href: "/app/chunking-studio", icon: Code2, category: "Build", keywords: ["chunking", "split", "text", "chunks"] },
  { id: "retrieval-lab", label: "Retrieval Lab", href: "/app/retrieval-lab", icon: FlaskConical, category: "Evaluate", keywords: ["retrieval", "lab", "test", "search"] },
  { id: "evaluation", label: "Evaluation", href: "/app/evaluation", icon: BarChart3, category: "Evaluate", keywords: ["evaluation", "metrics", "benchmark", "recall", "ndcg"] },
  { id: "chat", label: "RAG Chat", href: "/app/rag-chat", icon: Bot, category: "Explain", keywords: ["chat", "conversation", "rag", "ask"] },
  { id: "debugger", label: "Retrieval Debugger", href: "/app/rag-chat#debug", icon: Eye, category: "Explain", keywords: ["debug", "trace", "debugger", "inspect"] },
  { id: "architecture", label: "Architecture", href: "/app/architecture", icon: BookOpen, category: "Learn", keywords: ["architecture", "design", "system"] },
  { id: "guide", label: "Project Guide", href: "/app/project-guide", icon: GraduationCap, category: "Learn", keywords: ["guide", "tutorial", "learn", "getting started"] },
  { id: "settings", label: "Configuration", href: "/app/settings", icon: SlidersHorizontal, category: "System", keywords: ["settings", "config", "preferences"] },
  { id: "notebook", label: "Research Notebook", href: "/app/notebook", icon: NotebookPen, category: "Research", keywords: ["notebook", "notes", "journal", "markdown"] },
  { id: "benchmark-explorer", label: "Benchmark Explorer", href: "/app/benchmark-explorer", icon: FlaskConical, category: "Evaluate", keywords: ["benchmark", "explorer", "compare", "scatter"] },
  { id: "experiment-builder", label: "Experiment Builder", href: "/app/experiment-builder", icon: GitBranch, category: "Build", keywords: ["experiment", "builder", "workflow", "pipeline"] },
  { id: "publication", label: "Publication Mode", href: "/app/publication", icon: FileText, category: "Research", keywords: ["publication", "export", "paper", "report", "pdf"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { registerShortcut, unregisterShortcut } = useWorkspace();

  const filtered = useMemo(() => {
    return COMMANDS.filter((cmd) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.includes(q)) ||
        cmd.category.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const grouped = useMemo(() => {
    return filtered.reduce(
      (acc, cmd) => {
        (acc[cmd.category] ??= []).push(cmd);
        return acc;
      },
      {} as Record<string, CommandItem[]>
    );
  }, [filtered]);

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      setOpen(false);
      setQuery("");
      router.push(cmd.href);
    },
    [router]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    registerShortcut("command-palette", () => setOpen((p) => !p));
    return () => unregisterShortcut("command-palette");
  }, [registerShortcut, unregisterShortcut]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      executeCommand(filtered[selectedIndex]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
      />
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-surface shadow-xl overflow-hidden max-sm:mx-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={18} className="text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
          <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary/60">
                {category}
              </p>
              {items.map((cmd) => {
                const Icon = cmd.icon;
                const globalIndex = filtered.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      globalIndex === selectedIndex
                        ? "bg-brand/10 text-brand"
                        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cmd.label}</p>
                      {cmd.description && (
                        <p className="text-xs text-text-tertiary truncate">
                          {cmd.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-text-tertiary">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
        <div className="border-t border-border px-4 py-2 text-[10px] text-text-tertiary flex gap-4">
          <span>
            <kbd className="rounded border border-border bg-bg px-1 py-0.5">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border border-border bg-bg px-1 py-0.5">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded border border-border bg-bg px-1 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
