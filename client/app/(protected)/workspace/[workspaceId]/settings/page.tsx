"use client";

import React, { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Save, Settings, ChevronDown, Check } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { useWorkspace, useWorkspaces, NotebookIconPicker } from "@/features/workspaces";
import {
  CHAT_MODELS,
  CHAT_MODEL_LABELS,
  DEFAULT_CHAT_MODEL,
  resolveChatModel,
  type ChatModelId,
} from "@/features/chat/stores/chat-preferences";
import { cn } from "@/lib/utils";

const MODEL_DESCRIPTIONS: Record<ChatModelId, string> = {
  "gemini-3.6-flash": "Fast, grounded answers for everyday research",
  "gemini-3.5-flash-lite": "Lower-cost option for quick questions",
};

const MODEL_OPTIONS = CHAT_MODELS.map((id) => ({
  id,
  title: CHAT_MODEL_LABELS[id],
  desc: MODEL_DESCRIPTIONS[id],
}));


interface WorkspaceSettingsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default function WorkspaceSettingsPage({
  params,
}: WorkspaceSettingsPageProps) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { workspace, isLoading, updateWorkspace } = useWorkspace(workspaceId);
  const { deleteWorkspace } = useWorkspaces();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📚");
  const [defaultModel, setDefaultModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [isSaved, setIsSaved] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setIsModelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (workspace) {
      setTitle(workspace.title || "");
      setIcon(workspace.icon || "📚");
      setDefaultModel(resolveChatModel(workspace.defaultModel));
    }
  }, [workspace]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateWorkspace({
      title: title.trim(),
      icon,
      defaultModel,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDelete = async () => {
    if (
      confirm(
        `Are you sure you want to delete "${workspace?.title}"? All sources, notes, and chats will be permanently removed.`
      )
    ) {
      await deleteWorkspace(workspaceId);
      router.push("/dashboard");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <ThemeLoader size={36} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3.5 sm:px-6">
        <Link
          href={`/workspace/${workspaceId}`}
          className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">Back to workspace chat</span>
        </Link>
        <span className="kairos-eyebrow">Workspace settings</span>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-8 p-4 sm:p-6 md:p-8">
        <div>
          <p className="kairos-eyebrow">Preferences</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="kairos-inset flex size-10 items-center justify-center text-primary">
              <Settings className="size-5" />
            </span>
            <h1 className="kairos-section-title text-2xl text-foreground sm:text-3xl">
              Workspace configuration
            </h1>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Manage the workspace name, icon, default grounding model, and
            lifecycle settings.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="kairos-panel space-y-6 p-5 sm:p-6">
          {/* Icon Picker */}
          <NotebookIconPicker value={icon} onChange={setIcon} label="Notebook icon" />

          <div className="space-y-2">
            <label htmlFor="workspace-title" className="text-xs font-medium text-foreground">
              Workspace title
            </label>
            <input
              id="workspace-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div className="space-y-2" ref={modelRef}>
            <span id="default-model-label" className="text-xs font-medium text-foreground">
              Default AI model
            </span>
            <div className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isModelOpen}
                aria-labelledby="default-model-label"
                onClick={() => setIsModelOpen(!isModelOpen)}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5 text-left text-xs text-foreground transition-colors hover:bg-muted/40 motion-reduce:transition-none"
              >
                <div>
                  <span className="font-semibold block text-xs">
                    {MODEL_OPTIONS.find((m) => m.id === defaultModel)?.title || defaultModel}
                  </span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    {MODEL_OPTIONS.find((m) => m.id === defaultModel)?.desc}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0",
                    isModelOpen && "rotate-180"
                  )}
                />
              </button>

              {isModelOpen && (
                <div
                  role="listbox"
                  aria-labelledby="default-model-label"
                  className="kairos-panel absolute left-0 top-full z-30 mt-1.5 w-full animate-fadeIn space-y-1 bg-surface p-1.5 motion-reduce:animate-none"
                >
                  {MODEL_OPTIONS.map((opt) => {
                    const isSelected = opt.id === defaultModel;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setDefaultModel(opt.id);
                          setIsModelOpen(false);
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-lg p-2.5 text-left transition-colors motion-reduce:transition-none",
                          isSelected
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div>
                          <p className="text-xs font-medium">{opt.title}</p>
                          <p
                            className={cn(
                              "text-[11px] mt-0.5",
                              isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                            )}
                          >
                            {opt.desc}
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span role="status" className="text-xs font-medium text-success">
              {isSaved ? "Settings saved successfully." : ""}
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90 motion-reduce:transition-none"
            >
              <Save className="size-3.5" />
              Save changes
            </button>
          </div>
        </form>

        {/* Danger Zone */}
        <section className="space-y-4 rounded-[var(--radius-card)] border border-danger/25 bg-danger/5 p-5 sm:p-6">
          <div>
            <h3 className="kairos-section-title text-lg text-danger">Danger zone</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Deleting this workspace permanently removes its sources, indexes,
              study artifacts, and message transcripts.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-[var(--shadow-panel)] transition-colors hover:bg-destructive/90 motion-reduce:transition-none"
          >
            <Trash2 className="size-3.5" />
            Delete workspace
          </button>
        </section>
      </div>
    </div>
  );
}
