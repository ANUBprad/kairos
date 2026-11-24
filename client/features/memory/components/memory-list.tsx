"use client";

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Edit2, Check, X, Brain, Sparkles } from "lucide-react";
import type { AppMemory } from "../lib/types";
import { useMemories } from "../hooks/use-memories";
import { cn } from "@/lib/utils";

interface MemoryListProps {
  memories: AppMemory[];
}

export function MemoryList({ memories }: MemoryListProps) {
  const { deleteMemory, updateMemory } = useMemories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleStartEdit = (memory: AppMemory) => {
    setEditingId(memory.id);
    setEditText(memory.memory);
  };

  const handleSaveEdit = async (memoryId: string) => {
    if (!editText.trim()) return;
    await updateMemory.mutateAsync({
      memoryId,
      input: { memory: editText.trim() },
    });
    setEditingId(null);
  };

  if (memories.length === 0) {
    return (
      <div className="kairos-panel space-y-2 border-dashed p-10 text-center">
        <span className="kairos-inset mx-auto flex size-11 items-center justify-center text-primary">
          <Brain className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">
          No memories recorded yet
        </p>
        <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground">
          As you work through your sources, Kairos can learn your preferences and
          domain context. You can also add a fact yourself.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {memories.map((memory) => {
        const isEditing = editingId === memory.id;

        return (
          <div
            key={memory.id}
            className="kairos-card group flex flex-col gap-2 p-4 motion-reduce:transition-none"
          >
            <div className="flex items-start justify-between gap-3">
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <textarea
                    rows={2}
                    aria-label="Edit memory fact"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(memory.id)}
                      disabled={updateMemory.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <Check className="size-3" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-foreground leading-relaxed flex-1 whitespace-pre-wrap">
                  {memory.memory}
                </p>
              )}

              {!isEditing && (
                <div className="flex shrink-0 items-center gap-1 transition-opacity group-hover:opacity-100 motion-reduce:transition-none sm:opacity-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(memory)}
                    title="Edit memory"
                    aria-label="Edit memory fact"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this memory fact?")) {
                        deleteMemory.mutate(memory.id);
                      }
                    }}
                    title="Delete memory"
                    aria-label="Delete memory fact"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger motion-reduce:transition-none"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                  memory.source === "learned"
                    ? "border border-warning/20 bg-warning/10 text-warning"
                    : "kairos-tag px-2 py-0.5 text-[9px]"
                )}
              >
                {memory.source === "learned" ? "AI inferred" : "Manual"}
              </span>
              <span>·</span>
              <span>
                {formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
