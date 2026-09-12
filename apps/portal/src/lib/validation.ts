export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number (0-9)", test: (v: string) => /[0-9]/.test(v) },
] as const;

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "")
    .substring(0, 255);
}

const ID_MAX_LENGTH = 128;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

// Entity ids use Prisma cuid() (also tolerate uuid) — never charset-guess
// beyond a safe slug-like shape. Authorization is what actually secures the
// query, not this shape test.
export function isValidEntityId(id: string): boolean {
  return id.length > 0 && id.length <= ID_MAX_LENGTH && ID_PATTERN.test(id);
}
