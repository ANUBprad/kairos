"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateTextSource, getEditableTextSourceContent } from "@/lib/actions/document";
import { cn } from "@/lib/utils";

const MAX_TEXT_CHARS = 200_000;

interface Props {
  document: { id: string; name: string; sourceType: string; sourceUrl: string | null } | null;
  onClose: () => void;
}

export function SourceEditDialog({ document: doc, onClose }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!doc || doc.sourceType !== "TEXT") return;
    let cancelled = false;
    setLoadingContent(true);
    setLoadError(null);
    getEditableTextSourceContent(doc.id)
      .then((res) => {
        if (cancelled) return;
        setTitle(res.title ?? "");
        setContent(res.content);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load content");
      })
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (doc) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => dialogRef.current?.focus(), 100);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [doc]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    if (doc) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [doc, isLoading, onClose]);

  if (!doc) return null;
  if (doc.sourceType !== "TEXT") return null;

  const charOver = content.length > MAX_TEXT_CHARS;
  const canSubmit =
    content.trim().length > 0 && !charOver && !loadingContent && loadError === null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isLoading) return;
    setIsLoading(true);
    try {
      await updateTextSource(doc.id, { title, content });
      toast.success("Text source updated");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update source");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && onClose()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-edit-title"
        aria-describedby="source-edit-description"
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="source-edit-title" className="text-lg font-semibold text-text-primary">Edit text source</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary transition-colors hover:text-text-primary"
            disabled={isLoading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p id="source-edit-description" className="sr-only">
          Edit the title and raw text content of this source. The previous version stays available
          until the new one finishes processing, and a failed update rolls back to it.
        </p>

        {loadingContent ? (
          <div className="flex items-center justify-center py-16 text-sm text-text-tertiary">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Loading current content...
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              aria-label="Text source title"
              disabled={isLoading}
              maxLength={255}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste raw text, notes, or a transcript..."
              aria-label="Text source content"
              disabled={isLoading}
              rows={10}
              className="w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            />
            {loadError ? (
              <p className="text-xs text-error">{loadError}</p>
            ) : (
              <>
                <p className={cn("text-right text-xs", charOver ? "text-error" : "text-text-tertiary")}>
                  {content.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()} characters
                  {charOver && " — exceeds the limit"}
                </p>
                <p className="text-xs text-text-tertiary">
                  Existing content stays available while the new version processes; a failed update
                  rolls back to the last known-good version.
                </p>
              </>
            )}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={isLoading || !canSubmit}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </span>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}