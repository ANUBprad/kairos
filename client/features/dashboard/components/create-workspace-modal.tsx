"use client";

import React, { useState } from "react";
import { FolderPlus } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { NotebookIconPicker } from "@/features/workspaces";
import { dismissOnBackdropClick } from "@/lib/modal";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, icon: string) => Promise<void>;
  isCreating: boolean;
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSubmit,
  isCreating,
}: CreateWorkspaceModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📚");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit(title.trim(), description.trim(), icon);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-xs"
      onMouseDown={(e) => dismissOnBackdropClick(e, onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
        className="kairos-panel w-full max-w-md animate-fadeIn motion-reduce:animate-none space-y-5 p-6 text-foreground sm:p-7"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="kairos-inset flex h-9 w-9 items-center justify-center text-brand">
              <FolderPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="kairos-eyebrow">New notebook</p>
              <h3
                id="create-workspace-title"
                className="kairos-section-title mt-1 text-lg text-foreground"
              >
                Create New Workspace
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create workspace dialog"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shared Icon Picker */}
          <NotebookIconPicker value={icon} onChange={setIcon} label="Workspace Icon" />

          {/* Title Field */}
          <div className="space-y-1.5">
            <label htmlFor="create-workspace-title-field" className="text-xs font-medium text-foreground">Title</label>
            <input
              id="create-workspace-title-field"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Quantum Computing Research"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-1.5">
            <label htmlFor="create-workspace-description" className="text-xs font-medium text-foreground">Description (Optional)</label>
            <textarea
              id="create-workspace-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this notebook is about..."
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
              disabled={isCreating || !title.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-medium text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {isCreating ? <ThemeLoader size={16} /> : null}
              <span>Create Notebook</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
