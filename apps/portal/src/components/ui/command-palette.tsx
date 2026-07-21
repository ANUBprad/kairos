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
  Upload,
  Plus,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  action?: string;
  icon: LucideIcon;
  category: string;
  keywords: string[];
  shortcut?: string;
}

const NAVIGATION_COMMANDS: CommandItem[] = [
  { id: "overview", label: "Overview", href: "/app", icon: LayoutDashboard, category: "Navigation", keywords: ["dashboard", "home", "overview"] },
  { id: "research", label: "Research Dashboard", href: "/app/research", icon: Microscope, category: "Navigation", keywords: ["research", "dashboard", "metrics", "analysis"] },
  { id: "copilot", label: "AI Copilot", href: "/app/copilot", icon: Sparkles, category: "Navigation", keywords: ["copilot", "ai", "assistant", "recommendations"] },
  { id: "notebook", label: "Research Notebook", href: "/app/notebook", icon: NotebookPen, category: "Navigation", keywords: ["notebook", "notes", "journal", "markdown"] },
  { id: "lineage", label: "Experiment Lineage", href: "/app/lineage", icon: GitBranch, category: "Navigation", keywords: ["lineage", "history", "versions", "provenance"] },
  { id: "planner", label: "Experiment Planner", href: "/app/planner", icon: Lightbulb, category: "Navigation", keywords: ["planner", "plan", "experiment", "suggest"] },
  { id: "publication", label: "Publication Mode", href: "/app/publication", icon: FileText, category: "Navigation", keywords: ["publication", "export", "paper", "report", "pdf"] },
  { id: "documents", label: "Document Repository", href: "/app/knowledge-bases", icon: FolderOpen, category: "Navigation", keywords: ["documents", "knowledge", "base", "upload"] },
  { id: "chunking", label: "Chunking Studio", href: "/app/chunking-studio", icon: Code2, category: "Navigation", keywords: ["chunking", "split", "text", "chunks"] },
  { id: "experiment-builder", label: "Experiment Builder", href: "/app/experiment-builder", icon: FlaskConical, category: "Navigation", keywords: ["experiment", "builder", "workflow", "pipeline"] },
  { id: "retrieval-lab", label: "Retrieval Lab", href: "/app/retrieval-lab", icon: FlaskConical, category: "Navigation", keywords: ["retrieval", "lab", "test", "search"] },
  { id: "advanced-retrieval", label: "Advanced Retrieval", href: "/app/advanced-retrieval", icon: GitBranch, category: "Navigation", keywords: ["advanced", "retrieval", "hybrid", "bm25"] },
  { id: "evaluation", label: "Evaluation", href: "/app/evaluation", icon: BarChart3, category: "Navigation", keywords: ["evaluation", "metrics", "benchmark", "recall", "ndcg"] },
  { id: "benchmark-explorer", label: "Benchmark Explorer", href: "/app/benchmark-explorer", icon: FlaskConical, category: "Navigation", keywords: ["benchmark", "explorer", "compare", "scatter"] },
  { id: "chat", label: "RAG Chat", href: "/app/rag-chat", icon: Bot, category: "Navigation", keywords: ["chat", "conversation", "rag", "ask"] },
  { id: "debugger", label: "Retrieval Debugger", href: "/app/rag-chat#debug", icon: Eye, category: "Navigation", keywords: ["debug", "trace", "debugger", "inspect"] },
  { id: "architecture", label: "Architecture", href: "/app/architecture", icon: BookOpen, category: "Navigation", keywords: ["architecture", "design", "system"] },
  { id: "guide", label: "Project Guide", href: "/app/project-guide", icon: GraduationCap, category: "Navigation", keywords: ["guide", "tutorial", "learn", "getting started"] },
  { id: "settings", label: "Configuration", href: "/app/settings", icon: SlidersHorizontal, category: "Navigation", keywords: ["settings", "config", "preferences"] },
];

const ACTION_COMMANDS: CommandItem[] = [
  { id: "upload", label: "Upload Document", description: "Add files to a knowledge base", href: "/app/knowledge-bases", action: "upload", icon: Upload, category: "Actions", keywords: ["upload", "file", "document", "add"], shortcut: "U" },
  { id: "create-kb", label: "Create Knowledge Base", description: "Start a new knowledge base", href: "/app/knowledge-bases", action: "create-kb", icon: Plus, category: "Actions", keywords: ["create", "knowledge", "base", "new"], shortcut: "N" },
  { id: "new-chat", label: "Open RAG Chat", description: "Ask questions about your documents", href: "/app/rag-chat", action: "new-chat", icon: MessageSquare, category: "Actions", keywords: ["chat", "ask", "question", "rag"], shortcut: "R" },
  { id: "new-experiment", label: "New Experiment", description: "Build and test a retrieval pipeline", href: "/app/experiment-builder", action: "new-experiment", icon: FlaskConical, category: "Actions", keywords: ["experiment", "new", "build", "test"] },
  { id: "run-evaluation", label: "Run Evaluation", description: "Benchmark retrieval performance", href: "/app/evaluation", action: "run-evaluation", icon: BarChart3, category: "Actions", keywords: ["evaluation", "benchmark", "metrics"], shortcut: "E" },
  { id: "ask-copilot", label: "Ask Copilot", description: "Get AI-powered research insights", href: "/app/copilot", action: "ask-copilot", icon: Sparkles, category: "Actions", keywords: ["copilot", "ai", "help", "insight"] },
  { id: "open-lab", label: "Open Retrieval Lab", description: "Test retrieval configurations", href: "/app/retrieval-lab", action: "open-lab", icon: FlaskConical, category: "Actions", keywords: ["retrieval", "lab", "test"] },
];

const ALL_COMMANDS = [...NAVIGATION_COMMANDS, ...ACTION_COMMANDS];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { registerShortcut, unregisterShortcut } = useWorkspace();

  const filtered = useMemo(() => {
    return ALL_COMMANDS.filter((cmd) => {
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
      if (cmd.href) {
        router.push(cmd.href);
      }
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-surface shadow-xl overflow-hidden max-sm:mx-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={18} className="text-text-tertiary shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages and actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
            aria-label="Search commands"
          />
          <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2" role="listbox">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-2" role="group" aria-label={category}>
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
                    role="option"
                    aria-selected={globalIndex === selectedIndex}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      globalIndex === selectedIndex
                        ? "bg-brand/10 text-brand"
                        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    )}
                  >
                    <Icon size={16} className="shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cmd.label}</p>
                      {cmd.description && (
                        <p className="text-xs text-text-tertiary truncate">
                          {cmd.description}
                        </p>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary shrink-0">
                        {cmd.shortcut}
                      </kbd>
                    )}
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
        <div className="border-t border-border px-4 py-2 text-[10px] text-text-tertiary flex gap-4" aria-hidden="true">
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
