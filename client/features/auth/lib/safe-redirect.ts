// Kept dependency-free (no relative imports) so this security helper can be
// executed directly by the Node-based regression test as well as by Next.js.
const DEFAULT_REDIRECT = "/dashboard";

/**
 * Accepts only same-origin, absolute-path redirect targets.
 *
 * `callbackUrl` is attacker-controllable on /login and /signup. Passing it
 * straight to `router.push` permits external hard navigation (open redirect),
 * and `javascript:` values are executable by the client router. Values are
 * normalised through URL so the returned string is always a safe path.
 */
export function safeRedirectPath(candidate: string | null | undefined): string {
  if (!candidate || candidate.length > 2048) return DEFAULT_REDIRECT;
  if (!candidate.startsWith("/")) return DEFAULT_REDIRECT;

  // Protocol-relative and backslash forms can be treated as hosts by browsers.
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return DEFAULT_REDIRECT;
  }
  // Control characters and encoded separators/newlines must never survive.
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return DEFAULT_REDIRECT;
  if (/%(?:2f|5c|0a|0d)/i.test(candidate)) return DEFAULT_REDIRECT;

  try {
    const parsed = new URL(candidate, "https://kairos.invalid");
    if (parsed.origin !== "https://kairos.invalid") return DEFAULT_REDIRECT;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
