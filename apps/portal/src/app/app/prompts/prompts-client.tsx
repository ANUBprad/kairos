"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  FolderPlus,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Loader2,
  Tag,
  Clock,
  X,
  MoreHorizontal,
  Trash2,
  Copy,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { InputDialog } from "@/components/ui/input-dialog";
import {
  listPromptFolders,
  createPromptFolder,
  deletePromptFolder,
  listAllPrompts,
  createNewPrompt,
  deletePromptAction,
  clonePromptAction,
} from "@/lib/actions/prompts";

interface Folder {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  promptCount: number;
  createdAt: Date;
}

interface Prompt {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  folderId: string | null;
  ownerId: string;
  organizationId: string;
  currentVersionId: string | null;
  currentVersion: {
    id: string;
    version: number;
    title: string;
    description: string | null;
    systemPrompt: string;
    userPrompt: string;
    variables: unknown;
    model: string | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
}

type StatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "info"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export function PromptsClient() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingPrompt, setCreatingPrompt] = useState(false);

  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptDesc, setNewPromptDesc] = useState("");
  const [newPromptFolderId, setNewPromptFolderId] = useState<string>("");
  const [newPromptTags, setNewPromptTags] = useState("");

  const [contextMenuPromptId, setContextMenuPromptId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [folderRes, promptRes] = await Promise.all([
        listPromptFolders(),
        listAllPrompts({
          folderId: selectedFolderId ?? undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          tags: selectedTag ? [selectedTag] : undefined,
          search: searchQuery || undefined,
        }),
      ]);
      if (folderRes.success && folderRes.folders) {
        setFolders(folderRes.folders as Folder[]);
      }
      if (promptRes.success && promptRes.prompts) {
        setPrompts(promptRes.prompts as unknown as Prompt[]);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, [selectedFolderId, statusFilter, selectedTag, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handler = () => setContextMenuPromptId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const allTags = Array.from(new Set(prompts.flatMap((p) => p.tags))).sort();

  const filteredPrompts = prompts.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateFolder = async (name: string) => {
    setCreatingFolder(true);
    try {
      const res = await createPromptFolder({ name });
      if (res.success) {
        setShowCreateFolder(false);
        await fetchData();
      }
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleCreatePrompt = async () => {
    if (!newPromptTitle.trim()) return;
    setCreatingPrompt(true);
    try {
      const res = await createNewPrompt({
        title: newPromptTitle.trim(),
        description: newPromptDesc.trim() || undefined,
        folderId: newPromptFolderId || undefined,
        tags: newPromptTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        systemPrompt: "",
        userPrompt: "",
      });
      if (res.success) {
        setShowCreatePrompt(false);
        setNewPromptTitle("");
        setNewPromptDesc("");
        setNewPromptFolderId("");
        setNewPromptTags("");
        await fetchData();
      }
    } finally {
      setCreatingPrompt(false);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    setActionLoading(promptId);
    try {
      await deletePromptAction(promptId);
      setContextMenuPromptId(null);
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleClonePrompt = async (promptId: string) => {
    setActionLoading(promptId);
    try {
      await clonePromptAction(promptId);
      setContextMenuPromptId(null);
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setActionLoading(folderId);
    try {
      await deletePromptFolder(folderId);
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Prompt Library"
        description="Create, manage, and version your LLM prompts with full lifecycle control."
        purpose="Organize prompts into folders, track versions, and publish when ready."
        nextAction={{ label: "Knowledge Bases", href: "/app/knowledge-bases" }}
        relatedPages={[
          { label: "Copilot", href: "/app/copilot" },
          { label: "Evaluation", href: "/app/evaluation" },
        ]}
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar: Folders */}
        <aside className="w-full lg:w-64 shrink-0">
          <Card className="sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Folders</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateFolder(true)}
                className="h-8 px-2"
              >
                <FolderPlus size={14} />
              </Button>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedFolderId(null)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  selectedFolderId === null
                    ? "bg-brand/10 text-brand font-medium"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                )}
              >
                <FileText size={14} />
                <span className="flex-1">All Prompts</span>
                <span className="text-xs text-text-tertiary">{prompts.length}</span>
              </button>

              {folders.map((folder) => (
                <div key={folder.id}>
                  <div className="flex items-center group">
                    <button
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        toggleFolder(folder.id);
                      }}
                      className={cn(
                        "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                        selectedFolderId === folder.id
                          ? "bg-brand/10 text-brand font-medium"
                          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      )}
                    >
                      {expandedFolders.has(folder.id) ? (
                        <ChevronDown size={14} className="shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="shrink-0" />
                      )}
                      <Folder size={14} className="shrink-0" />
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span className="text-xs text-text-tertiary">{folder.promptCount}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/10 text-text-tertiary hover:text-error transition-all"
                      disabled={actionLoading === folder.id}
                    >
                      {actionLoading === folder.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {folders.length === 0 && (
                <p className="text-xs text-text-tertiary px-3 py-4 text-center">
                  No folders yet. Create one to organize your prompts.
                </p>
              )}
            </div>
          </Card>
        </aside>

        {/* Main: Prompts */}
        <main className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts..."
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <div className="flex items-center rounded-lg border border-border bg-surface overflow-hidden">
                <Filter size={14} className="ml-3 text-text-tertiary" />
                {(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      statusFilter === s
                        ? "bg-brand/10 text-brand"
                        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    )}
                  >
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* View Toggle */}
              <div className="flex items-center rounded-lg border border-border bg-surface overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === "grid"
                      ? "bg-brand/10 text-brand"
                      : "text-text-secondary hover:bg-surface-hover"
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === "list"
                      ? "bg-brand/10 text-brand"
                      : "text-text-secondary hover:bg-surface-hover"
                  )}
                  aria-label="List view"
                >
                  <List size={14} />
                </button>
              </div>

              <Button variant="primary" size="sm" onClick={() => setShowCreatePrompt(true)}>
                <Plus size={14} />
                Create Prompt
              </Button>
            </div>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <Tag size={12} className="text-text-tertiary" />
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                    selectedTag === tag
                      ? "border-brand/30 bg-brand/10 text-brand"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-brand" />
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
                <FileText size={24} className="text-text-tertiary" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">No prompts found</h3>
              <p className="text-sm text-text-secondary max-w-sm">
                {searchQuery || statusFilter !== "ALL" || selectedTag
                  ? "Try adjusting your filters or search query."
                  : "Create your first prompt to get started with the Prompt Library."}
              </p>
              {!searchQuery && statusFilter === "ALL" && !selectedTag && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowCreatePrompt(true)}
                >
                  <Plus size={14} />
                  Create Prompt
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPrompts.map((prompt) => (
                <Card
                  key={prompt.id}
                  className="relative group hover:border-border-hover transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary truncate">
                        {prompt.title}
                      </h4>
                      {prompt.description && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                          {prompt.description}
                        </p>
                      )}
                    </div>
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuPromptId(
                            contextMenuPromptId === prompt.id ? null : prompt.id
                          );
                        }}
                        className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {contextMenuPromptId === prompt.id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-border bg-surface shadow-xl py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleClonePrompt(prompt.id)}
                            disabled={actionLoading === prompt.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                          >
                            <Copy size={14} />
                            Clone
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            disabled={actionLoading === prompt.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
                          >
                            {actionLoading === prompt.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={STATUS_VARIANT[prompt.status] ?? "default"}>
                      {prompt.status.charAt(0) + prompt.status.slice(1).toLowerCase()}
                    </Badge>
                    <span className="text-xs text-text-tertiary">
                      v{prompt.version}
                    </span>
                  </div>

                  {prompt.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {prompt.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-text-tertiary border border-border"
                        >
                          {tag}
                        </span>
                      ))}
                      {prompt.tags.length > 4 && (
                        <span className="text-[10px] text-text-tertiary">
                          +{prompt.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-text-tertiary">
                    <Clock size={11} />
                    <span>{formatDate(prompt.createdAt)}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="space-y-2">
              {filteredPrompts.map((prompt) => (
                <Card
                  key={prompt.id}
                  className="relative group hover:border-border-hover transition-colors py-3 px-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-semibold text-text-primary truncate">
                          {prompt.title}
                        </h4>
                        <Badge variant={STATUS_VARIANT[prompt.status] ?? "default"}>
                          {prompt.status.charAt(0) + prompt.status.slice(1).toLowerCase()}
                        </Badge>
                        <span className="text-xs text-text-tertiary shrink-0">
                          v{prompt.version}
                        </span>
                      </div>
                      {prompt.description && (
                        <p className="text-xs text-text-secondary mt-1 truncate">
                          {prompt.description}
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      {prompt.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-text-tertiary border border-border"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-text-tertiary shrink-0">
                      <Clock size={11} />
                      <span>{formatDate(prompt.createdAt)}</span>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuPromptId(
                            contextMenuPromptId === prompt.id ? null : prompt.id
                          );
                        }}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {contextMenuPromptId === prompt.id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-border bg-surface shadow-xl py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleClonePrompt(prompt.id)}
                            disabled={actionLoading === prompt.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                          >
                            <Copy size={14} />
                            Clone
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            disabled={actionLoading === prompt.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
                          >
                            {actionLoading === prompt.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Folder Dialog */}
      <InputDialog
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onSubmit={handleCreateFolder}
        title="Create Folder"
        description="Organize your prompts into folders for easier management."
        placeholder="Folder name..."
        isLoading={creatingFolder}
        confirmLabel="Create Folder"
      />

      {/* Create Prompt Dialog */}
      {showCreatePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !creatingPrompt && setShowCreatePrompt(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text-primary">Create Prompt</h2>
              <button
                onClick={() => setShowCreatePrompt(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
                disabled={creatingPrompt}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Title <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={newPromptTitle}
                  onChange={(e) => setNewPromptTitle(e.target.value)}
                  placeholder="e.g., Summarization Prompt v2"
                  disabled={creatingPrompt}
                  className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Description
                </label>
                <textarea
                  value={newPromptDesc}
                  onChange={(e) => setNewPromptDesc(e.target.value)}
                  placeholder="What is this prompt used for?"
                  rows={2}
                  disabled={creatingPrompt}
                  className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Folder
                </label>
                <select
                  value={newPromptFolderId}
                  onChange={(e) => setNewPromptFolderId(e.target.value)}
                  disabled={creatingPrompt}
                  className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
                >
                  <option value="">No folder (root)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Tags
                </label>
                <input
                  type="text"
                  value={newPromptTags}
                  onChange={(e) => setNewPromptTags(e.target.value)}
                  placeholder="Comma-separated, e.g., summarization, production"
                  disabled={creatingPrompt}
                  className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
                />
                <p className="text-[11px] text-text-tertiary mt-1">Separate tags with commas</p>
              </div>
            </div>

            <div className="flex gap-3 pt-5">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowCreatePrompt(false)}
                disabled={creatingPrompt}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={handleCreatePrompt}
                disabled={creatingPrompt || !newPromptTitle.trim()}
              >
                {creatingPrompt ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Create Prompt"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
