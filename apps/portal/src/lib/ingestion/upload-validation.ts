export const ALLOWED_EXTENSIONS: readonly string[] = ["pdf", "txt", "md", "markdown", "csv", "docx"];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function getFileType(name: string, mime: string): string {
  const hasExtension = name.includes(".");
  const ext = name.split(".").pop()?.toLowerCase() || "";
  // A named extension is authoritative. Falling back to the browser MIME for a
  // file called "report.exe" would store it as a PDF while keeping the
  // misleading name, so unknown extensions are rejected instead.
  if (hasExtension) return ext;
  return MIME_MAP[mime] || "";
}

// Extensions and browser MIME types are attacker-controlled metadata. Check the
// actual bytes so a text file cannot masquerade as a PDF (or vice versa).
export function assertFileContentMatchesType(name: string, buffer: Buffer, fileType: string): void {
  if (fileType === "pdf") {
    if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new Error(`"${name}" is not a valid PDF. Re-export the file and try again.`);
    }
    return;
  }
  if (fileType === "docx") {
    if (!buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
      throw new Error(`"${name}" is not a valid DOCX file (expected an Office Open XML package).`);
    }
    return;
  }
  // Text formats: reject binary containers and NUL bytes that slipped past the
  // extension check.
  if (
    buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC) ||
    buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC) ||
    buffer.includes(0)
  ) {
    throw new Error(`"${name}" does not contain readable text. Upload a text-based file instead.`);
  }
}

export interface UploadCandidate {
  file: { name: string };
  hash: string;
}

export interface SkippedUpload {
  name: string;
  reason: string;
}

// One duplicate in a batch must not reject the whole batch. Returns the entries
// that are safe to store plus an honest per-file reason for each skipped one.
export function partitionDuplicateUploads<T extends UploadCandidate>(
  entries: T[],
  existingByHash: Map<string, { name: string }>,
): { pending: T[]; skipped: SkippedUpload[] } {
  const pending: T[] = [];
  const skipped: SkippedUpload[] = [];
  const seenHashes = new Set<string>();

  for (const entry of entries) {
    const existing = existingByHash.get(entry.hash);
    if (existing) {
      skipped.push({
        name: entry.file.name,
        reason: `"${entry.file.name}" is a duplicate of "${existing.name}" (same content)`,
      });
      continue;
    }
    if (seenHashes.has(entry.hash)) {
      skipped.push({
        name: entry.file.name,
        reason: `"${entry.file.name}" duplicates another file in this upload`,
      });
      continue;
    }
    seenHashes.add(entry.hash);
    pending.push(entry);
  }

  return { pending, skipped };
}
