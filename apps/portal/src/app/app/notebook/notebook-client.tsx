"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  Plus,
  NotebookPen,
  FileText,
  BarChart3,
  Image,
  Trash2,
  Edit3,
  Clock,
  Download,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface NotebookEntry {
  id: string;
  title: string;
  content: string;
  type: "note" | "chart" | "table" | "benchmark" | "screenshot";
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "kairos-notebook-entries";

function loadEntries(): NotebookEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: NotebookEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    logger.error("Failed to save notebook entries", { error: error instanceof Error ? error.message : String(error) });
  }
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  chart: BarChart3,
  table: BarChart3,
  benchmark: NotebookPen,
  screenshot: Image,
};

const TYPE_COLORS: Record<string, string> = {
  note: "text-info",
  chart: "text-brand",
  table: "text-success",
  benchmark: "text-warning",
  screenshot: "text-text-secondary",
};

export function NotebookPageClient() {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEntries(loadEntries());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveEntries(entries);
    }
  }, [entries, mounted]);

  const allTags = [...new Set(entries.flatMap((e) => e.tags))];

  const filtered = entries.filter((e) => {
    const matchesSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !selectedTag || e.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  function addEntry() {
    const newEntry: NotebookEntry = {
      id: Date.now().toString(),
      title: "New Note",
      content: "",
      type: "note",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEntries([newEntry, ...entries]);
    setEditingId(newEntry.id);
  }

  function deleteEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id));
  }

  function clearAll() {
    setEntries([]);
  }

  function exportNotebook() {
    const md = filtered
      .map(
        (e) =>
          `## ${e.title}\n\n${e.content}\n\n*Tags: ${e.tags.join(", ")} | ${e.createdAt}*\n\n---`
      )
      .join("\n\n");
    const blob = new Blob([`# Research Notebook\n\n${md}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notebook.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Research Notebook"
        description="Create, organize, and export research notes with charts, tables, and experiment references."
        purpose="Capture insights, observations, and findings during your RAG research experiments."
        nextAction={{ label: "New Note", href: "#" }}
        relatedPages={[
          { label: "Research Dashboard", href: "/app/research" },
          { label: "Publication Mode", href: "/app/publication" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedTag(null)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !selectedTag ? "bg-brand/10 text-brand" : "border border-border text-text-secondary hover:bg-surface-hover"
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                selectedTag === tag ? "bg-brand/10 text-brand" : "border border-border text-text-secondary hover:bg-surface-hover"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
        <button
          onClick={exportNotebook}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <Download size={14} />
          Export
        </button>
        <button
          onClick={addEntry}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-hover transition-colors"
        >
          <Plus size={14} />
          New Note
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <NotebookPen size={40} className="mb-3 text-text-tertiary" />
          <p className="text-sm font-medium text-text-secondary">No notes yet</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Click &ldquo;New Note&rdquo; to start capturing research insights.
          </p>
          {entries.length > 0 && (
            <button
              onClick={clearAll}
              className="mt-4 flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-error hover:bg-error/10 transition-colors"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => {
            const Icon = TYPE_ICONS[entry.type] || FileText;
            return (
              <PremiumCard key={entry.id} variant="elevated" className="group">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5", TYPE_COLORS[entry.type])}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === entry.id ? (
                        <input
                          autoFocus
                          defaultValue={entry.title}
                          onBlur={(e) => {
                            setEntries(
                              entries.map((en) =>
                                en.id === entry.id ? { ...en, title: e.target.value } : en
                              )
                            );
                            setEditingId(null);
                          }}
                          className="w-full bg-transparent text-sm font-semibold text-text-primary outline-none border-b border-brand"
                        />
                      ) : (
                        <h3
                          className="text-sm font-semibold text-text-primary truncate cursor-pointer"
                          onClick={() => setEditingId(entry.id)}
                        >
                          {entry.title}
                        </h3>
                      )}
                      <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                        {entry.content || "No content"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingId(entry.id)}
                        className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-secondary"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="rounded p-1 text-text-tertiary hover:bg-error/10 hover:text-error"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-text-tertiary">
                    <Clock size={10} />
                    {new Date(entry.updatedAt).toLocaleDateString()}
                    <div className="flex items-center gap-1 ml-auto">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-bg px-2 py-0.5 text-[9px] font-medium text-text-tertiary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </PremiumCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
