import { z } from "zod";

export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number (0-9)", test: (v: string) => /[0-9]/.test(v) },
] as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(255, "Name is too long");

export const descriptionSchema = z
  .string()
  .trim()
  .max(1000, "Description is too long")
  .optional()
  .or(z.literal(""));

export const emailSchema = z.string().email("Invalid email address");

export const querySchema = z
  .string()
  .trim()
  .min(1, "Query is required")
  .max(10000, "Query is too long");

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const fileUploadSchema = z.object({
  name: z
    .string()
    .min(1, "Filename is required")
    .max(255, "Filename is too long")
    .regex(/^[a-zA-Z0-9._-]+$/, "Filename contains invalid characters"),
  size: z.number().int().min(1, "File is empty").max(10 * 1024 * 1024, "File exceeds 10MB limit"),
  type: z.string().min(1, "MIME type is required"),
});

export const ALLOWED_FILE_EXTENSIONS = ["pdf", "txt", "md", "markdown", "csv", "docx"] as const;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext as never)) {
    return { valid: false, error: `File type "${ext}" is not supported. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(", ")}` };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: `"${file.name}" exceeds the 10MB size limit` };
  }

  if (file.size === 0) {
    return { valid: false, error: `"${file.name}" is empty` };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "")
    .substring(0, 255);
}
