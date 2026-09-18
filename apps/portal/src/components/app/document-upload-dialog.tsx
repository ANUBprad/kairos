"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  FileWarning,
  RefreshCw,
  FileSpreadsheet,
  FileType,
} from "lucide-react";
import type { DocumentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadDocument, listDocuments, reprocessDocument } from "@/lib/actions/document";
import {
  POLL_INTERVAL_MS,
  allTerminal,
  anyLiveTracking,
  tickBudget,
  processingPresentation,
} from "@/lib/upload-progress";

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
  docId?: string;
  backendStatus?: DocumentStatus;
}

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".csv", ".docx"];
const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument",
];
const MAX_SIZE = 10 * 1024 * 1024;

function getMimeCategory(mime: string): string {
  return ALLOWED_MIME_PREFIXES.find((p) => mime.startsWith(p)) || "";
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return <FileText size={18} className="shrink-0 text-error" />;
    case "docx": return <FileType size={18} className="shrink-0 text-info" />;
    case "csv": return <FileSpreadsheet size={18} className="shrink-0 text-success" />;
    default: return <FileText size={18} className="shrink-0 text-text-secondary" />;
  }
}

interface Props {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFiles: string[];
}

export function DocumentUploadDialog({ kbId, open, onOpenChange, existingFiles }: Props) {
  const router = useRouter();
  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pollExpired, setPollExpired] = useState(false);
  const queueRef = useRef<UploadFile[]>(uploadQueue);
  const ticksRef = useRef(0);
  const autoClosedRef = useRef(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueRef.current = uploadQueue;
  }, [uploadQueue]);

  useEffect(() => {
    if (!open) {
      setUploadQueue([]);
      setIsUploading(false);
      setPollExpired(false);
      ticksRef.current = 0;
      autoClosedRef.current = false;
    }
  }, [open]);

  // Bounded polling: while any accepted source is non-terminal, read its real
  // status from the KB-scoped (session-authorized) listDocuments action and
  // stop at terminal success/error, dialog close, or the tick budget.
  useEffect(() => {
    if (!open) return;
    ticksRef.current = 0;
    setPollExpired(false);

    const timer = setInterval(async () => {
      const tracked = queueRef.current.filter((f) => f.docId !== undefined);
      if (tracked.length === 0) return;
      if (allTerminal(tracked.map((f) => f.backendStatus))) return;

      ticksRef.current += 1;
      if (tickBudget(ticksRef.current) === "expired") {
        setPollExpired(true);
        return;
      }

      try {
        const docs = await listDocuments(kbId);
        const byId = new Map(docs.map((d) => [d.id, d.status]));
        setUploadQueue((prev) =>
          prev.map((f) => {
            if (f.docId === undefined) return f;
            const status = byId.get(f.docId);
            if (status === undefined) return f;
            if (status === "INDEXED" || status === "READY") {
              return { ...f, backendStatus: status, status: "done" };
            }
            if (status === "ERROR") {
              return { ...f, backendStatus: status, status: "error", error: "Processing failed" };
            }
            return { ...f, backendStatus: status as DocumentStatus, status: "processing" };
          }),
        );
      } catch {
        // transient failure; the next tick retries
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [open, kbId]);

  // Auto-close only once every submitted source has reached a terminal state;
  // claiming "done" on submission would lie about a source that is still being
  // embedded.
  useEffect(() => {
    if (!open || autoClosedRef.current) return;
    if (isUploading || uploadQueue.length === 0) return;
    if (uploadQueue.some((f) => f.status === "pending" || f.status === "uploading")) return;

    const submitted = uploadQueue.filter((f) => f.docId !== undefined);
    if (!anyLiveTracking(submitted.map((f) => f.backendStatus))) return;
    if (!allTerminal(submitted.map((f) => f.backendStatus))) return;

    autoClosedRef.current = true;
    const ready = submitted.filter((f) => f.backendStatus === "INDEXED" || f.backendStatus === "READY").length;
    if (ready > 0) toast.success(`${ready} source${ready !== 1 ? "s" : ""} ready`);
    router.refresh();
    onOpenChange(false);
  }, [open, isUploading, uploadQueue, router, onOpenChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "Tab" && dropRef.current) {
        const dialog = dropRef.current.closest('[role="dialog"]');
        if (!dialog) return;
        const focusableElements = dialog.querySelectorAll<HTMLElement>(
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
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onOpenChange]);

  const validateFile = useCallback(
    (file: File): string | null => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `Unsupported file type ".${ext.slice(1)}". Allowed: PDF, DOCX, TXT, MD, CSV`;
      }
      if (!getMimeCategory(file.type)) {
        return `Unexpected MIME type "${file.type}" for extension "${ext}"`;
      }
      if (file.size > MAX_SIZE) {
        return `File exceeds the 10MB size limit`;
      }
      if (file.size === 0) {
        return `File is empty`;
      }
      if (existingFiles.includes(file.name)) {
        return `A file named "${file.name}" already exists`;
      }
      return null;
    },
    [existingFiles],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newFiles: UploadFile[] = [];
      for (const file of Array.from(files)) {
        const error = validateFile(file);
        newFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          status: error ? "error" : "pending",
          error: error || undefined,
        });
      }
      setUploadQueue((prev) => [...prev, ...newFiles]);
    },
    [validateFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Remove only sources that were never submitted; anything already accepted
  // keeps processing server-side and is removed from the queue view alone.
  const removeFile = useCallback((id: string) => {
    setUploadQueue((prev) =>
      prev.filter((f) => f.id !== id || (f.status !== "pending" && !(f.status === "error" && f.docId === undefined))),
    );
  }, []);

  const retrySubmission = useCallback((id: string) => {
    setUploadQueue((prev) =>
      prev.map((f) =>
        f.id === id && f.status === "error" && f.docId === undefined
          ? { ...f, status: "pending" as const, error: undefined }
          : f,
      ),
    );
  }, []);

  const retryProcessing = useCallback(
    async (id: string) => {
      try {
        const formData = new FormData();
        formData.append("id", id);
        await reprocessDocument(formData);
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, status: "processing" as const, backendStatus: "QUEUED" as DocumentStatus, error: undefined }
              : f,
          ),
        );
        toast.info("Reprocessing started");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not restart processing");
      }
    },
    [],
  );

  const clearErrors = useCallback(() => {
    setUploadQueue((prev) => prev.filter((f) => f.status !== "error"));
  }, []);

  const startUpload = async () => {
    const pending = uploadQueue.filter((f) => f.status === "pending");
    if (pending.length === 0) {
      toast.error("No valid files to upload");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of pending) {
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "uploading" as const } : f,
        ),
      );

      try {
        const formData = new FormData();
        formData.append("files", item.file);

        const results = await uploadDocument(kbId, formData);
        const created = results[0];

        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: "processing" as const, docId: created.id, backendStatus: created.status as DocumentStatus }
              : f,
          ),
        );
        successCount++;
      } catch (err) {
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "error" as const,
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : f,
          ),
        );
        failCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.info(`${successCount} file${successCount !== 1 ? "s" : ""} accepted — processing in the background`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} file${failCount !== 1 ? "s" : ""} failed to upload`);
    }
  };

  if (!open) return null;

  const pendingCount = uploadQueue.filter((f) => f.status === "pending").length;
  const uploadingCount = uploadQueue.filter((f) => f.status === "uploading").length;
  const processingCount = uploadQueue.filter((f) => f.status === "processing").length;
  const doneCount = uploadQueue.filter((f) => f.status === "done").length;
  const errorCount = uploadQueue.filter((f) => f.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={dropRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        aria-describedby="upload-dialog-description"
        tabIndex={-1}
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-xl max-h-[80vh] outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="upload-dialog-title" className="text-lg font-semibold text-text-primary">Upload documents</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-text-tertiary transition-colors hover:text-text-primary"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p id="upload-dialog-description" className="sr-only">Upload PDF, DOCX, TXT, MD, or CSV files up to 10MB each.</p>

        <div className="flex-1 overflow-y-auto p-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all",
              isDragging
                ? "border-brand bg-brand/5"
                : "border-border hover:border-border-hover hover:bg-surface-hover",
            )}
            onClick={() => inputRef.current?.click()}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
              <Upload size={28} className="text-brand" />
            </div>
            <p className="mt-4 text-sm font-medium text-text-primary">
              Drop files here or click to browse
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              PDF, DOCX, TXT, MD, CSV &mdash; up to 10MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.docx"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {uploadQueue.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">
                  {uploadQueue.length} file{uploadQueue.length !== 1 ? "s" : ""}
                  {pendingCount > 0 && ` · ${pendingCount} ready`}
                  {uploadingCount + processingCount > 0 && ` · ${uploadingCount + processingCount} processing`}
                  {doneCount > 0 && ` · ${doneCount} ready`}
                </p>
                {!isUploading && errorCount > 0 && (
                  <button
                    onClick={clearErrors}
                    className="text-xs text-text-tertiary hover:text-text-secondary"
                  >
                    Clear errors
                  </button>
                )}
              </div>

              {uploadQueue.map((item) => {
                const presentation = processingPresentation(item.backendStatus);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-all",
                      item.status === "error" && "border-error/20 bg-error/5",
                      item.status === "done" && "border-success/20",
                      item.status !== "error" && item.status !== "done" && "border-border",
                    )}
                  >
                    {item.status === "done" ? (
                      <CheckCircle2 size={18} className="shrink-0 text-success" />
                    ) : item.status === "error" ? (
                      <FileWarning size={18} className="shrink-0 text-error" />
                    ) : item.status === "uploading" || item.status === "processing" ? (
                      <Loader2 size={18} className="shrink-0 animate-spin text-brand" />
                    ) : (
                      getFileIcon(item.file.name)
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {item.file.name}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          item.status === "error"
                            ? "text-error"
                            : item.status === "done"
                              ? "text-success"
                              : "text-text-tertiary",
                        )}
                      >
                        {item.status === "done"
                          ? "Ready to use"
                          : item.status === "error"
                            ? (item.error ?? presentation.label)
                            : item.status === "uploading"
                              ? `${(item.file.size / 1024).toFixed(1)} KB · Uploading…`
                              : item.status === "pending"
                                ? `${(item.file.size / 1024).toFixed(1)} KB · Ready to upload`
                                : `${(item.file.size / 1024).toFixed(1)} KB · ${presentation.label}`}
                      </p>
                      {item.status === "error" && item.docId === undefined && item.error && (
                        <p className="mt-0.5 text-xs text-error">{item.error}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {item.status === "error" && !isUploading && (
                        <button
                          onClick={() =>
                            item.docId === undefined ? retrySubmission(item.id) : retryProcessing(item.id)
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          title="Retry"
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}
                      {item.status === "pending" && (
                        <button
                          onClick={() => removeFile(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          title="Remove"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {pollExpired && (
                <p className="text-xs text-text-tertiary">
                  Sources are still processing — they continue in the background and will appear in the table when done.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-text-tertiary">
            {uploadingCount + processingCount > 0 || doneCount > 0
              ? "Processing continues in the background — closing keeps it running."
              : `${pendingCount} file${pendingCount !== 1 ? "s" : ""} ready`}
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={startUpload}
              disabled={isUploading || pendingCount === 0}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Uploading...
                </span>
              ) : (
                `Upload${pendingCount > 0 ? ` (${pendingCount})` : ""}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}