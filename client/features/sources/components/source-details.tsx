"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ExternalLink, RefreshCw, Layers, FileText, Download, Loader2 } from "lucide-react";
import { downloadImageFile } from "../lib/download-image";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { CircularLoader } from "@/components/ui/circular-loader";
import { useSource, useReprocessSource } from "../hooks/use-sources";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import { sourceRoutes } from "../lib/routes";
import { MarkdownPreview } from "./markdown-preview";
import { SourceStatusBadge } from "./source-status-badge";
import { SourceTypeIcon } from "./source-type-icon";
import { cn } from "@/lib/utils";

interface SourceDetailProps {
  workspaceId: string;
  sourceId: string;
}

export function SourceDetail({ workspaceId, sourceId }: SourceDetailProps) {
  const { data: source, isLoading, error } = useSource(workspaceId, sourceId);
  const reprocessMutation = useReprocessSource(workspaceId);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);

  if (isLoading) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-muted-foreground"
        role="status"
        aria-label="Loading source details"
      >
        <ThemeLoader size={32} />
        <span className="text-xs">Loading source details...</span>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center"
        role="alert"
      >
        <p className="kairos-section-title text-sm text-destructive">
          Could not load source
        </p>
        <Link
          href={sourceRoutes.list(workspaceId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-brand/30 hover:bg-brand-quiet hover:text-brand motion-reduce:transition-none"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to library
        </Link>
      </div>
    );
  }

  const metadata = source.metadata || {};
  const fileUrl = typeof metadata.fileUrl === "string" ? metadata.fileUrl : null;
  const fileName = typeof metadata.fileName === "string" ? metadata.fileName : null;
  const chunkCount = typeof metadata.chunkCount === "number" ? metadata.chunkCount : null;
  const processingError = typeof metadata.processingError === "string" ? metadata.processingError : null;
  const isProcessing = source.status === "PENDING" || source.status === "PROCESSING";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 pb-10 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href={sourceRoutes.list(workspaceId)}
            aria-label="Back to source library"
            className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand-quiet hover:text-brand motion-reduce:transition-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md border border-border bg-brand-quiet">
                <SourceTypeIcon type={source.type} source={source} />
              </div>
              <h2 className="kairos-section-title truncate text-lg text-primary">
                {source.title}
              </h2>
              <SourceStatusBadge status={source.status} />
            </div>

            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{SOURCE_TYPE_LABELS[source.type]}</span>
              <span>·</span>
              <span>
                Added {formatDistanceToNow(new Date(source.createdAt), { addSuffix: true })}
              </span>
              {chunkCount !== null && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Layers className="size-3" aria-hidden="true" />
                    {chunkCount} chunks indexed
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {source.status === "FAILED" && (
          <button
            type="button"
            onClick={() => reprocessMutation.mutate(source.id)}
            disabled={reprocessMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-brand/30 hover:bg-brand-quiet hover:text-brand disabled:opacity-50 motion-reduce:transition-none"
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                reprocessMutation.isPending && "animate-spin motion-reduce:animate-none"
              )}
              aria-hidden="true"
            />
            Retry
          </button>
        )}
      </div>

      {/* External URL if present */}
      {source.url && source.type !== "IMAGE" && (
        <div className="kairos-inset flex items-center gap-2 rounded-lg p-3 text-xs text-muted-foreground">
          <ExternalLink className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="shrink-0">URL:</span>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-brand underline underline-offset-4 hover:no-underline"
          >
            {source.url}
          </a>
        </div>
      )}

      {/* PDF file info */}
      {source.type === "PDF" && fileUrl && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-xs shadow-[var(--shadow-panel)]">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-brand" aria-hidden="true" />
            <div>
              <p className="font-medium text-primary">{fileName || "Uploaded PDF"}</p>
              <p className="text-[11px] text-muted-foreground">
                Ready for grounded queries
              </p>
            </div>
          </div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-brand/30 bg-brand-soft px-3 py-1.5 font-medium text-brand transition-colors hover:bg-brand-soft/70 motion-reduce:transition-none"
          >
            Open PDF
          </a>
        </div>
      )}

      {source.type === "IMAGE" && fileUrl && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
          <div className="flex items-center justify-between gap-2 text-xs">
            <p className="font-medium text-primary">{fileName || "Uploaded image"}</p>
            <button
              type="button"
              disabled={isDownloadingImage}
              onClick={async () => {
                setIsDownloadingImage(true);
                try {
                  await downloadImageFile(
                    fileUrl,
                    fileName || source.title,
                  );
                } catch {
                  window.open(fileUrl, "_blank", "noopener,noreferrer");
                } finally {
                  setIsDownloadingImage(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-soft px-3 py-1.5 font-medium text-brand transition-colors hover:bg-brand-soft/70 disabled:opacity-50 motion-reduce:transition-none"
            >
              {isDownloadingImage ? (
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
            className="max-h-80 w-full rounded-lg border border-border bg-brand-quiet object-contain"
          />
        </div>
      )}

      {/* Main Content / Status State */}
      {isProcessing ? (
        <div
          className="space-y-2 rounded-2xl border border-dashed border-border bg-brand-quiet p-12 text-center"
          role="status"
        >
          <CircularLoader size={36} className="mx-auto text-brand" />
          <p className="kairos-section-title text-sm text-primary">
            Processing source
          </p>
          <p className="text-[11px] text-muted-foreground">
            {source.type === "IMAGE"
              ? "Running OCR, chunking text, and building the search index."
              : "Extracting text, chunking passages, and embedding the vector index."}
          </p>
        </div>
      ) : source.status === "FAILED" ? (
        <div
          className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-xs text-destructive"
          role="alert"
        >
          <p className="font-semibold">Processing failed</p>
          <p className="text-muted-foreground">
            {processingError || "An error occurred during extraction or embedding."}
          </p>
        </div>
      ) : source.content ? (
        <div className="space-y-2">
          <h3 className="kairos-eyebrow">Extracted content</h3>
          <MarkdownPreview content={source.content} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-brand-quiet p-8 text-center text-xs text-muted-foreground">
          No extracted content available for this source.
        </div>
      )}
    </div>
  );
}
