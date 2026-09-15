"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  updateTextSource,
  getEditableTextSourceContent,
  repointUrlSource,
  repointYouTubeSource,
} from "@/lib/actions/document";
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
  const [url, setUrl] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isText = doc?.sourceType === "TEXT";
  const isUrl = doc?.sourceType === "URL";
  const isYoutube = doc?.sourceType === "YOUTUBE";

  useEffect(() => {
    if (!doc) return;
    if (isUrl || isYoutube) {
      setUrl(doc.sourceUrl ?? "");
      return;
    }
    if (!isText) return;
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
  }, [doc, isText, isUrl, isYoutube]);

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
  if (!isText && !isUrl && !isYoutube) return null;

  const textCharOver = content.length > MAX_TEXT_CHARS;
  const canSubmitText =
    content.trim().length > 0 && !textCharOver && !loadingContent && loadError === null && !isLoading;
  const trimmedUrl = url.trim();
  const canSubmitUrl = trimmedUrl.length > 0 && !isLoading;

  const onSubmitText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitText || isLoading) return;
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

  const onSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitUrl) return;
    setIsLoading(true);
    try {
      if (isYoutube) {
        await repointYouTubeSource(doc.id, trimmedUrl);
        toast.success("Video source updated");
      } else {
        await repointUrlSource(doc.id, trimmedUrl);
        toast.success("URL source updated");
      }
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update URL source");
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
          <h2 id="source-edit-title" className="text-lg font-semibold text-text-primary">
            {isText ? "Edit text source" : isYoutube ? "Change the source video" : "Change the source URL"}
          </h2>
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
          {isText
            ? "Edit the title and raw text content of this source. The previous version stays available until the new one finishes processing, and a failed update rolls back to it."
            : isYoutube
              ? "Change the video this source points to. The new video's transcript is fetched and validated before anything changes; on a failure the previous source stays intact."
              : "Change the URL this source points to. The new address is validated before anything changes; on a failure the previous source stays intact."}
        </p>

        {isText && loadingContent ? (
          <div className="flex items-center justify-center py-16 text-sm text-text-tertiary">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Loading current content...
          </div>
        ) : isText ? (
          <form onSubmit={onSubmitText} className="space-y-3">
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
                <p className={cn("text-right text-xs", textCharOver ? "text-error" : "text-text-tertiary")}>
                  {content.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()} characters
                  {textCharOver && " — exceeds the limit"}
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
              <Button type="submit" variant="primary" className="flex-1" disabled={!canSubmitText}>
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
        ) : isUrl ? (
          <form onSubmit={onSubmitUrl} className="space-y-3">
            <p className="text-xs text-text-tertiary">
              Current URL: {doc.sourceUrl || "none"}
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              aria-label="New source URL"
              disabled={isLoading}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            />
            <p className="text-xs text-text-tertiary">
              The new address is fully validated before anything changes; on a failure the previous
              source stays intact.
            </p>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={!canSubmitUrl}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </span>
                ) : (
                  "Update URL"
                )}
              </Button>
            </div>
          </form>
        ) : isYoutube ? (
          <form onSubmit={onSubmitUrl} className="space-y-3">
            <p className="text-xs text-text-tertiary">
              Current video: {doc.sourceUrl || "none"}
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
              aria-label="New source video URL"
              disabled={isLoading}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            />
            <p className="text-xs text-text-tertiary">
              The new video's transcript is fetched and validated before anything changes; on a
              failure the previous source stays intact.
            </p>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={!canSubmitUrl}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </span>
                ) : (
                  "Update video"
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
