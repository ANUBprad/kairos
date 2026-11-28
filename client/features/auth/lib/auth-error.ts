// Dependency-free so the Node regression guard can import it directly.
export type AuthProvider = "google" | "github";

const PROVIDER_LABEL: Record<AuthProvider, string> = {
  google: "Google",
  github: "GitHub",
};

/** Fixed, sanitized messages. Provider-supplied descriptions are never displayed. */
const CALLBACK_ERROR_MESSAGES: Record<string, (provider: string) => string> = {
  access_denied: (p) => `${p} sign-in was cancelled or denied. Please try again.`,
  user_denied: (p) => `${p} sign-in was cancelled or denied. Please try again.`,
  cancelled: (p) => `${p} sign-in was cancelled. Please try again.`,
  redirect_uri_mismatch: (p) =>
    `${p} sign-in is not configured correctly. Check the registered callback URL.`,
  invalid_client: (p) =>
    `${p} sign-in is not configured correctly. Check the provider credentials.`,
  oauth_provider_not_found: (p) =>
    `${p} sign-in is unavailable because the provider is not configured on the server.`,
  configuration: (p) =>
    `${p} sign-in is unavailable because the provider is not configured on the server.`,
  state_not_found: () =>
    "The sign-in session expired or was invalid. Please start sign-in again.",
  invalid_state: () =>
    "The sign-in session expired or was invalid. Please start sign-in again.",
  state_mismatch: () =>
    "The sign-in session expired or was invalid. Please start sign-in again.",
  nonce_binding_missing: () =>
    "The sign-in session expired or was invalid. Please start sign-in again.",
  issuer_mismatch: () =>
    "The sign-in session expired or was invalid. Please start sign-in again.",
  invalid_code: () =>
    "The provider did not return a valid authorization code. Please try again.",
  no_code: () => "The provider did not return an authorization code. Please try again.",
  unable_to_get_user_info: (p) =>
    `We could not read your ${p} account details. Please try again or use email sign-in.`,
  email_not_verified: (p) =>
    `Your ${p} account email is not verified. Verify it with ${p} and try again.`,
  email_not_found: (p) =>
    `Your ${p} account does not expose an email address. Use email sign-in instead.`,
  unable_to_link_account: (p) =>
    `We could not link that ${p} account. Use email sign-in or contact support.`,
  account_already_linked_to_different_user: () =>
    "That provider account is linked to a different Kairos account. Sign in with email for help.",
  email_does_not_match: () =>
    "The provider email does not match your Kairos account. Sign in with email instead.",
  no_callback_url: () => "The sign-in callback is missing. Please try again.",
};

const GENERIC_CALLBACK_ERROR = (provider: string) =>
  `We couldn't complete ${provider} sign-in. Please try again.`;

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const code = value.trim().toLowerCase();
  return /^[a-z0-9_]{1,64}$/.test(code) ? code : "";
}

function errorCode(error: unknown): string {
  if (typeof error === "string") return normalizeCode(error);
  if (!error || typeof error !== "object") return "";
  const record = error as Record<string, unknown>;
  return normalizeCode(record.code ?? record.errorCode ?? record.reason);
}

/** Maps a fixed OAuth callback code to a user-facing message. */
export function oauthCallbackError(
  code: unknown,
  provider: AuthProvider = "google",
): string | null {
  const normalized = errorCode(code);
  if (!normalized) return null;
  const label = PROVIDER_LABEL[provider];
  return (CALLBACK_ERROR_MESSAGES[normalized] ?? GENERIC_CALLBACK_ERROR)(label);
}

/**
 * Reads Better Auth's callback query. `error_description` is deliberately
 * ignored because provider text can contain account details or internal URLs.
 */
export function authErrorFromQuery(
  params: URLSearchParams,
  fallbackProvider: AuthProvider = "google",
): string | null {
  const rawProvider = params.get("auth_provider");
  const provider: AuthProvider =
    rawProvider === "github" || rawProvider === "google" ? rawProvider : fallbackProvider;

  const code = params.get("error");
  if (!code) return null;
  return oauthCallbackError(code, provider);
}

/** Maps immediate sign-in errors without exposing raw provider messages. */
export function friendlyAuthError(error: unknown, provider: AuthProvider): string {
  const label = PROVIDER_LABEL[provider];
  const mapped = oauthCallbackError(errorCode(error), provider);
  if (mapped) return mapped;

  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  if (/not configured|missing client|invalid client|callback url|redirect uri/i.test(message)) {
    return `${label} sign-in is not configured correctly. Check the server OAuth settings.`;
  }
  if (/network|fetch failed|timeout|temporarily unavailable/i.test(message)) {
    return `We couldn't reach ${label}. Check your connection and try again.`;
  }
  return GENERIC_CALLBACK_ERROR(label);
}
