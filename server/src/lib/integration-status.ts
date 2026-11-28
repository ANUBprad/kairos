import { AppError } from "../types/app-error.js";

/**
 * Connection status is derived from token usability, not row existence.
 *
 * A row with an expired access token is only usable when a refresh token is
 * stored (Google Drive). Providers without a refresh flow (GitHub) must be
 * reconnected. No token value is ever returned to a caller of this helper.
 */
export interface IntegrationTokenState {
    expiresAt?: Date | string | null;
    refreshToken?: string | null;
}

const EXPIRY_SKEW_MS = 30_000;

export function hasUsableIntegrationToken(
    account: IntegrationTokenState | null | undefined,
    nowMs: number = Date.now(),
): boolean {
    if (!account) return false;

    const expiresAtMs = account.expiresAt
        ? new Date(account.expiresAt).getTime()
        : NaN;
    if (!Number.isFinite(expiresAtMs)) return true;
    // A small skew avoids flapping to "reconnect" for a token that is only
    // seconds from expiry. The refresh path still renews early on its own.
    if (expiresAtMs > nowMs - EXPIRY_SKEW_MS) return true;

    return (
        typeof account.refreshToken === "string" &&
        account.refreshToken.trim().length > 0
    );
}

/** Reads the provider status attached to safe service errors, when present. */
export function providerFailureStatus(error: unknown): number | null {
    if (!(error instanceof AppError)) return null;
    const details = error.details;
    if (!details || typeof details !== "object") return null;
    const status = (details as { status?: unknown }).status;
    return typeof status === "number" && Number.isInteger(status) ? status : null;
}
