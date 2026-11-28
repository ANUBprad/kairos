"use client";

import React, { useState } from "react";
import { Plus, X, Brain } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { useMemories } from "../hooks/use-memories";
import { dismissOnBackdropClick } from "@/lib/modal";

interface AddMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMemoryDialog({ open, onOpenChange }: AddMemoryDialogProps) {
  const [memoryText, setMemoryText] = useState("");
  const [infer, setInfer] = useState(false);
  const { createMemory } = useMemories();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryText.trim()) return;

    await createMemory.mutateAsync({
      memory: memoryText.trim(),
      infer,
    });
    setMemoryText("");
    onOpenChange(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-overlay backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => dismissOnBackdropClick(e, () => onOpenChange(false))}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-memory-title"
        className="kairos-panel w-full max-w-lg animate-fadeIn overflow-hidden bg-surface text-foreground motion-reduce:animate-none"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="kairos-inset flex size-8 items-center justify-center text-primary">
              <Brain className="size-4" />
            </span>
            <h2 id="add-memory-title" className="kairos-section-title text-lg">
              Add a memory fact
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="space-y-2">
            <label
              htmlFor="memory-fact"
              className="text-xs font-medium text-foreground"
            >
              Memory fact or preference
            </label>
            <textarea
              id="memory-fact"
              rows={4}
              required
              value={memoryText}
              onChange={(e) => setMemoryText(e.target.value)}
              placeholder="e.g., I prefer TypeScript code examples with strict typing and concise explanations."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Kairos will store this fact and use it to personalize responses
              across your workspaces.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMemory.isPending || !memoryText.trim()}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90 disabled:opacity-50 motion-reduce:transition-none"
            >
              {createMemory.isPending ? (
                <ThemeLoader size={16} />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>Save memory</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
