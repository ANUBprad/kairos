export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getFileIcon(fileType: string): string {
  switch (fileType.toLowerCase()) {
    case "pdf": return "file-text";
    case "docx": return "file-text";
    case "txt": return "file-text";
    case "md":
    case "markdown": return "file-code";
    case "csv": return "file-spreadsheet";
    default: return "file";
  }
}

export function getStatusColor(status: string): { dot: string; text: string; bg: string } {
  switch (status) {
    case "READY":
    case "INDEXED":
      return { dot: "bg-success", text: "text-success", bg: "bg-success/10" };
    case "ERROR":
      return { dot: "bg-error", text: "text-error", bg: "bg-error/10" };
    case "QUEUED":
    case "UPLOADING":
    case "STORED":
      return { dot: "bg-info", text: "text-info", bg: "bg-info/10" };
    case "EXTRACTING":
    case "CHUNKING":
    case "EMBEDDING_PENDING":
    case "EMBEDDING":
      return { dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" };
    default:
      return { dot: "bg-text-tertiary", text: "text-text-tertiary", bg: "bg-surface-hover" };
  }
}

export function isProcessingStatus(status: string): boolean {
  return ["QUEUED", "UPLOADING", "STORED", "EXTRACTING", "CHUNKING", "EMBEDDING_PENDING", "EMBEDDING"].includes(status);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
