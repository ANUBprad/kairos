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
  XCircle,
  Ban,
  FileSpreadsheet,
  FileType,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadDocument } from "@/lib/actions/document";

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
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
  const abortRef = useRef<Map<string, boolean>>(new Map());
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setUploadQueue([]);
      setIsUploading(false);
      abortRef.current.clear();
      for (const interval of intervalsRef.current.values()) {
        clearInterval(interval);
      }
      intervalsRef.current.clear();
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading) onOpenChange(false);
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
  }, [open, isUploading, onOpenChange]);

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
          progress: 0,
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

  const removeFile = useCallback((id: string) => {
    abortRef.current.set(id, true);
    setUploadQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const cancelUpload = useCallback((id: string) => {
    abortRef.current.set(id, true);
    setUploadQueue((prev) =>
      prev.map((f) =>
        f.id === id && (f.status === "pending" || f.status === "uploading")
          ? { ...f, status: "cancelled" as const, error: "Upload cancelled" }
          : f,
      ),
    );
  }, []);

  const retryFile = useCallback((id: string) => {
    setUploadQueue((prev) =>
      prev.map((f) =>
        f.id === id && f.status === "error"
          ? { ...f, status: "pending" as const, progress: 0, error: undefined }
          : f,
      ),
    );
  }, []);

  const clearErrors = useCallback(() => {
    setUploadQueue((prev) =>
      prev.filter((f) => f.status !== "error" || !f.error),
    );
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
      if (abortRef.current.get(item.id)) continue;

      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "uploading" as const, progress: 0 } : f,
        ),
      );

      const progressInterval = setInterval(() => {
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === item.id && f.progress < 85
              ? { ...f, progress: f.progress + Math.random() * 15 }
              : f,
          ),
        );
      }, 300);
      intervalsRef.current.set(item.id, progressInterval);

      try {
        const formData = new FormData();
        formData.append("files", item.file);

        await uploadDocument(kbId, formData);

        clearInterval(progressInterval);
        intervalsRef.current.delete(item.id);

        if (abortRef.current.get(item.id)) continue;

        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, progress: 100, status: "done" as const } : f,
          ),
        );
        successCount++;
      } catch (err) {
        clearInterval(progressInterval);
        intervalsRef.current.delete(item.id);

        if (abortRef.current.get(item.id)) continue;

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
      toast.success(`${successCount} file(s) uploaded successfully`);
      router.refresh();
    }

    if (failCount > 0) {
      toast.error(`${failCount} file(s) failed to upload`);
    }

    if (successCount > 0 && failCount === 0) {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  const pendingCount = uploadQueue.filter((f) => f.status === "pending").length;
  const uploadingCount = uploadQueue.filter((f) => f.status === "uploading").length;
  const doneCount = uploadQueue.filter((f) => f.status === "done").length;
  const errorCount = uploadQueue.filter((f) => f.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isUploading && onOpenChange(false)}
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
            disabled={isUploading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p id="upload-dialog-description" className="sr-only">Upload PDF, DOCX, TXT, MD, or CSV files up to 10MB each.</p>

        <div className="flex-1 overflow-y-auto p-6">
          <div
            ref={dropRef}
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
                  {doneCount > 0 && ` (${doneCount} done)`}
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

              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-all",
                    item.status === "error" && "border-error/20 bg-error/5",
                    item.status === "cancelled" && "border-text-tertiary/20 opacity-50",
                    item.status !== "error" &&
                      item.status !== "cancelled" &&
                      "border-border",
                  )}
                >
                  {item.status === "done" ? (
                    <CheckCircle2 size={18} className="shrink-0 text-success" />
                  ) : item.status === "error" ? (
                    <FileWarning size={18} className="shrink-0 text-error" />
                  ) : item.status === "cancelled" ? (
                    <Ban size={18} className="shrink-0 text-text-tertiary" />
                  ) : item.status === "uploading" ? (
                    <Loader2 size={18} className="shrink-0 animate-spin text-brand" />
                  ) : (
                    getFileIcon(item.file.name)
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {(item.file.size / 1024).toFixed(1)} KB
                    </p>
                    {item.status === "uploading" && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                        <div
                          className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
                          style={{ width: `${Math.min(item.progress, 100)}%` }}
                        />
                      </div>
                    )}
                    {item.status === "error" && item.error && (
                      <p className="mt-0.5 text-xs text-error">{item.error}</p>
                    )}
                    {item.status === "cancelled" && (
                      <p className="mt-0.5 text-xs text-text-tertiary">Cancelled</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {item.status === "error" && !isUploading && (
                      <button
                        onClick={() => retryFile(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                        title="Retry"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                    {(item.status === "uploading" || item.status === "pending") && (
                      <button
                        onClick={() => cancelUpload(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-error"
                        title="Cancel"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                    {!isUploading && item.status !== "uploading" && item.status !== "done" && (
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
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-text-tertiary">
            {pendingCount} file{pendingCount !== 1 ? "s" : ""} ready
            {uploadingCount > 0 && `, ${uploadingCount} uploading`}
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
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
