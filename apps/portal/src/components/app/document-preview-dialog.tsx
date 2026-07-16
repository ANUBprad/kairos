"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  FileText,
  Loader2,
  BookOpen,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingBadge } from "@/components/app/processing-badge";
import { getDocument, getDocumentPreviewContent } from "@/lib/actions/document";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

interface PreviewResult {
  content: string | null;
  chunkCount: number;
  status: string;
  fileType: string;
  storageUrl: string | null;
  type: "pdf" | "docx" | "csv" | "text" | "markdown";
  metadata: Record<string, unknown> | null;
  uploadedBy: string;
  createdAt: string;
  size: number;
}

interface DocumentData {
  id: string;
  name: string;
  fileType: string;
  size: number;
  status: string;
  storageProvider: string;
  storageUrl: string | null;
  metadata: unknown;
  createdAt: Date;
  uploadedBy: { id: string; name: string | null; image: string | null } | null;
  _count: { chunks: number };
}

interface Props {
  docId: string | null;
  onClose: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderCsvTable(content: string) {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return null;
  const headers = parseCsvRow(lines[0]);
  const rows = lines.slice(1).map(parseCsvRow);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-hover">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-text-primary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 500).map((row, ri) => (
            <tr key={ri} className="border-b border-border hover:bg-surface-hover">
              {headers.map((_, ci) => (
                <td key={ci} className="px-3 py-1.5 text-text-secondary">
                  {row[ci] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 500 && (
        <p className="p-3 text-center text-xs text-text-tertiary">
          Showing 500 of {rows.length} rows
        </p>
      )}
    </div>
  );
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function DocumentPreviewDialog({ docId, onClose }: Props) {
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"content" | "original">("content");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (docId) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => dialogRef.current?.focus(), 100);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [docId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
    if (docId) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [docId, onClose]);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    setViewMode("content");

    Promise.all([
      getDocument(docId),
      getDocumentPreviewContent(docId),
    ])
      .then(([docData, previewData]) => {
        setDoc(docData as unknown as DocumentData);
        setPreview(previewData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      })
      .finally(() => setLoading(false));
  }, [docId]);

  if (!docId) return null;

  const metadata = preview?.metadata || (doc?.metadata as Record<string, unknown> | null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-dialog-title"
        aria-describedby="preview-dialog-description"
        tabIndex={-1}
        className="relative z-10 flex w-full max-w-5xl flex-col rounded-2xl border border-border bg-surface shadow-xl max-h-[90vh] outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {preview?.type === "pdf" ? (
              <FileCode size={20} className="shrink-0 text-text-secondary" />
            ) : preview?.type === "csv" ? (
              <FileSpreadsheet size={20} className="shrink-0 text-text-secondary" />
            ) : (
              <FileText size={20} className="shrink-0 text-text-secondary" />
            )}
            <h2 id="preview-dialog-title" className="truncate text-lg font-semibold text-text-primary">
              {doc?.name || "Loading..."}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-text-tertiary transition-colors hover:text-text-primary"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p id="preview-dialog-description" className="sr-only">Document preview and properties viewer.</p>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
              {preview?.type === "pdf" && preview.storageUrl && (
                <div className="flex gap-2 border-b border-border px-4 py-2">
                  <button
                    onClick={() => setViewMode("original")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === "original"
                        ? "bg-brand/10 text-brand"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setViewMode("content")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === "content"
                        ? "bg-brand/10 text-brand"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Extracted Text
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6">
                {viewMode === "original" && preview?.type === "pdf" && preview.storageUrl ? (
                  <iframe
                    src={preview.storageUrl}
                    className="h-full w-full rounded-lg border border-border"
                    title="PDF Preview"
                  />
                ) : preview?.content ? (
                  <div className="space-y-4">
                    {preview.type === "markdown" ? (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <MarkdownRenderer
                          content={
                            preview.content.length > 100000
                              ? preview.content.slice(0, 100000) + "\n\n*Content truncated...*"
                              : preview.content
                          }
                        />
                      </div>
                    ) : preview.type === "csv" ? (
                      renderCsvTable(preview.content)
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-mono text-sm text-text-primary leading-relaxed">
                        {preview.content.length > 100000
                          ? preview.content.slice(0, 100000) + "\n\n... (truncated)"
                          : preview.content}
                      </pre>
                    )}
                  </div>
                ) : preview?.status === "READY" && preview?.chunkCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <BookOpen size={32} className="text-text-tertiary" />
                    <p className="mt-4 text-sm text-text-secondary">
                      No text content available for preview
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 size={32} className="animate-spin text-text-tertiary" />
                    <p className="mt-4 text-sm text-text-secondary">
                      Document is still processing
                    </p>
                    <ProcessingBadge status={preview?.status || doc?.status || ""} className="mt-3" />
                  </div>
                )}
              </div>
            </div>

            <div className="w-64 shrink-0 border-l border-border p-5 overflow-y-auto hidden lg:block">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Properties
              </h3>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[11px] text-text-tertiary">Status</p>
                  <div className="mt-1">
                    <ProcessingBadge status={preview?.status || doc?.status || ""} />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-text-tertiary">Type</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {(preview?.fileType || doc?.fileType || "").toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-text-tertiary">Size</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {formatSize(preview?.size || doc?.size || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-text-tertiary">Uploaded</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {preview?.createdAt
                      ? new Date(preview.createdAt).toLocaleDateString()
                      : doc
                        ? new Date(doc.createdAt).toLocaleDateString()
                        : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-text-tertiary">Uploaded by</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {preview?.uploadedBy || doc?.uploadedBy?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-text-tertiary">Chunks</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {preview?.chunkCount || doc?._count.chunks || 0}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-text-tertiary">Storage</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {doc?.storageProvider || "cloudinary"}
                  </p>
                </div>
                {metadata?.pages != null && (
                  <div>
                    <p className="text-[11px] text-text-tertiary">Pages</p>
                    <p className="mt-0.5 text-sm text-text-primary">{String(metadata.pages)}</p>
                  </div>
                )}
                {metadata?.extractedChars != null && (
                  <div>
                    <p className="text-[11px] text-text-tertiary">Characters</p>
                    <p className="mt-0.5 text-sm text-text-primary">
                      {Number(metadata.extractedChars).toLocaleString()}
                    </p>
                  </div>
                )}
                {metadata?.rows != null && (
                  <div>
                    <p className="text-[11px] text-text-tertiary">Data Rows</p>
                    <p className="mt-0.5 text-sm text-text-primary">
                      {String(metadata.rows)}
                    </p>
                  </div>
                )}
                {metadata?.columns != null && (
                  <div>
                    <p className="text-[11px] text-text-tertiary">Data Columns</p>
                    <p className="mt-0.5 text-sm text-text-primary">
                      {String(metadata.columns)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
