"use client";

import React, { useState } from "react";
import { Source } from "../lib/types";
import { X, Calendar, Layers, ExternalLink, Download, Loader2 } from "lucide-react";
import { downloadImageFile } from "../lib/download-image";
import { SourceTypeIcon } from "./source-type-icon";
import { SourceStatusBadge } from "./source-status-badge";
import { MarkdownPreview } from "./markdown-preview";
import { formatDate } from "@/lib/utils";
import { dismissOnBackdropClick } from "@/lib/modal";

interface SourcePreviewDialogProps {
  source: Source | null;
  onClose: () => void;
}

export function SourcePreviewDialog({
  source,
  onClose,
}: SourcePreviewDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!source) return null;

  const metadata = source.metadata || {};
  const fileName =
    typeof metadata.fileName === "string" ? metadata.fileName : source.title;
  const chunkCount = typeof metadata.chunkCount === "number" ? metadata.chunkCount : null;
  const fileUrl =
    typeof metadata.fileUrl === "string"
      ? metadata.fileUrl
      : source.url ?? null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => dismissOnBackdropClick(e, onClose)}
    >
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-foreground shadow-[var(--shadow-lift)] animate-fadeIn motion-reduce:animate-none sm:max-h-[85vh] sm:max-w-3xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5 pr-2 sm:gap-3 sm:pr-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-brand-quiet">
              <SourceTypeIcon type={source.type} source={source} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="kairos-section-title truncate text-sm text-primary">
                  {source.title}
                </h2>
                <SourceStatusBadge status={source.status} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                <span>{source.type}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" aria-hidden="true" />
                  {formatDate(source.createdAt)}
                </span>
                {chunkCount !== null && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Layers className="size-3" aria-hidden="true" />
                      {chunkCount} chunks indexed
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close source preview"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-brand-quiet hover:text-brand motion-reduce:transition-none"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 text-foreground overscroll-contain">
          {source.url && source.type !== "IMAGE" && (
            <div className="kairos-inset flex items-center gap-2 rounded-lg p-3 text-xs">
              <ExternalLink
                className="size-3.5 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">URL: </span>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-brand underline underline-offset-4 hover:no-underline"
              >
                {source.url}
              </a>
            </div>
          )}

          {source.type === "IMAGE" && fileUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="kairos-eyebrow">Image</h3>
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={async () => {
                    setIsDownloading(true);
                    try {
                      await downloadImageFile(fileUrl, fileName);
                    } catch {
                      window.open(fileUrl, "_blank", "noopener,noreferrer");
                    } finally {
                      setIsDownloading(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-1.5 text-[11px] font-medium text-brand transition-colors hover:bg-brand-soft/70 disabled:opacity-50 motion-reduce:transition-none"
                >
                  {isDownloading ? (
                    <Loader2
                      className="size-3.5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Download className="size-3.5" aria-hidden="true" />
                  )}
                  Download image
                </button>
              </div>
              <img
                src={fileUrl}
                alt={source.title}
                className="max-h-64 w-full rounded-xl border border-border bg-brand-quiet object-contain"
              />
            </div>
          )}

          {source.content ? (
            <div className="space-y-2">
              <h3 className="kairos-eyebrow">
                {source.type === "IMAGE" ? "OCR & description" : "Extracted content"}
              </h3>
              <MarkdownPreview content={source.content} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-brand-quiet p-8 text-center text-xs text-muted-foreground">
              No content preview available for this source.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
