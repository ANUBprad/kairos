// Dependency-free so the Node regression guard can import it directly.
export type IntegrationProviderKey = "googleDrive" | "github" | "notion";

const LABELS: Record<IntegrationProviderKey, string> = {
  googleDrive: "Google Drive",
  github: "GitHub",
  notion: "Notion",
};

const MESSAGES: Record<string, (label: string) => string> = {
  access_denied: (label) => `${label} authorization was cancelled or denied. Please try again.`,
  invalid_scope: (label) =>
    `${label} needs the requested access. Reconnect and approve all required permissions.`,
  invalid_code: () => "The provider did not return a valid authorization code. Please try again.",
  oauth_failed: (label) => `${label} authorization failed. Please try again.`,
  oauth_state_invalid: () =>
    "The authorization session expired or was invalid. Please start connecting again.",
  callback_failed: (label) =>
    `Could not connect ${label}. Check the registered callback URL and try again.`,
  oauth_invalid_state: () =>
    "The authorization session expired or was invalid. Please start connecting again.",
};

const GENERIC = (label: string) => `${label} authorization failed. Please try again.`;

function normalizeCode(value: string | null): string {
  if (!value) return "";
  const code = value.trim().toLowerCase();
  return /^[a-z0-9_]{1,64}$/.test(code) ? code : "";
}

/**
 * Reads only fixed server-issued codes. Provider-supplied error text is never
 * read: it can contain account details, internal URLs, or arbitrary markup.
 */
export function integrationErrorFromQuery(
  params: URLSearchParams,
): { provider: IntegrationProviderKey; message: string } | null {
  const candidates: Array<[IntegrationProviderKey, string | null]> = [
    ["googleDrive", params.get("google_drive_error")],
    ["github", params.get("github_error")],
    ["notion", params.get("error")],
  ];

  for (const [provider, raw] of candidates) {
    const code = normalizeCode(raw);
    if (!code) continue;
    const label = LABELS[provider];
    return { provider, message: (MESSAGES[code] ?? GENERIC)(label) };
  }
  return null;
}
