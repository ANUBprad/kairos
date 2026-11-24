"use client";

import React, { useState, useEffect } from "react";
import { Edit3 } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { NotebookIconPicker } from "@/features/workspaces";
import { Workspace } from "@/hooks/use-workspaces";
import { dismissOnBackdropClick } from "@/lib/modal";

interface EditWorkspaceModalProps {
  workspace: Workspace | null;
  onClose: () => void;
  onSubmit: (id: string, title: string, description: string, icon: string) => Promise<void>;
  isUpdating: boolean;
}

export function EditWorkspaceModal({
  workspace,
  onClose,
  onSubmit,
  isUpdating,
}: EditWorkspaceModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📚");

  useEffect(() => {
    if (workspace) {
      setTitle(workspace.title);
      setDescription(workspace.description || "");
      setIcon(workspace.icon || "📚");
    }
  }, [workspace]);

  if (!workspace) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit(workspace.id, title.trim(), description.trim(), icon);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onMouseDown={(e) => dismissOnBackdropClick(e, onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-workspace-title"
        className="kairos-panel w-full max-w-md animate-fadeIn motion-reduce:animate-none space-y-5 p-6 text-foreground sm:p-7"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="kairos-inset flex h-9 w-9 items-center justify-center text-brand">
              <Edit3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="kairos-eyebrow">Notebook settings</p>
              <h3
                id="edit-workspace-title"
                className="kairos-section-title mt-1 text-lg text-foreground"
              >
                Edit Notebook
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit workspace dialog"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shared Icon Picker */}
          <NotebookIconPicker value={icon} onChange={setIcon} label="Notebook Icon" />

          {/* Title Field */}
          <div className="space-y-1.5">
            <label htmlFor="edit-workspace-title-field" className="text-xs font-medium text-foreground">Title</label>
            <input
              id="edit-workspace-title-field"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notebook Title"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-1.5">
            <label htmlFor="edit-workspace-description" className="text-xs font-medium text-foreground">Description (Optional)</label>
            <textarea
              id="edit-workspace-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notebook Description"
              className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating || !title.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-medium text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {isUpdating ? <ThemeLoader size={16} /> : null}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
