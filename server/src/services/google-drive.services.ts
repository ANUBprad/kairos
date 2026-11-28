import { getWorkspaceByIdForUser } from "./workspace.services.js";
import { assertCanCreateSource } from "./usage.services.js";
import { createAndProcessSource } from "./source.services.js";
import {
    deleteConnectedAccountByProvider,
    findConnectedAccount,
    updateConnectedAccountTokens,
    upsertConnectedAccountRecord,
} from "../repository/integration.repository.js";
import { extractText } from "unpdf";
import { NotFoundError, ValidationError } from "../types/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { logger } from "../lib/logger.js";
import { providerFetch } from "../lib/provider-http.js";
import {
    getOAuthCallbackUrl,
    OAUTH_CALLBACK_PATHS,
} from "../lib/oauth-callback.js";
import { importDriveFileSchema } from "../validators/integration.validator.js";
import { providerFailureStatus } from "../lib/integration-status.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Drive searches are bounded before escaping so a trailing escape cannot break the query grammar. */
export const GOOGLE_DRIVE_SEARCH_MAX_CHARS = 200;
/** Matches the existing 25 MB PDF upload boundary. */
export const GOOGLE_DRIVE_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const GOOGLE_DRIVE_PAGE_SIZE = 30;
const MAX_PAGE_TOKEN_CHARS = 2048;
const TOKEN_EXPIRY_SKEW_MS = 30_000;

/**
 * Dependencies are injectable so provider failures and refresh races can be
 * exercised with mocks. Production uses the real repository and fetch wrapper.
 */
export interface GoogleDriveDeps {
    fetch?: typeof providerFetch;
    findAccount?: typeof findConnectedAccount;
    deleteAccount?: typeof deleteConnectedAccountByProvider;
    updateTokens?: typeof updateConnectedAccountTokens;
    getWorkspace?: typeof getWorkspaceByIdForUser;
    assertQuota?: typeof assertCanCreateSource;
    createSource?: typeof createAndProcessSource;
    now?: () => number;
}

type ResolvedDeps = {
    fetch: typeof providerFetch;
    findAccount: typeof findConnectedAccount;
    deleteAccount: typeof deleteConnectedAccountByProvider;
    updateTokens: typeof updateConnectedAccountTokens;
    getWorkspace: typeof getWorkspaceByIdForUser;
    assertQuota: typeof assertCanCreateSource;
    createSource: typeof createAndProcessSource;
    now: () => number;
};

function resolveDeps(deps?: GoogleDriveDeps): ResolvedDeps {
    return {
        fetch: deps?.fetch ?? providerFetch,
        findAccount: deps?.findAccount ?? findConnectedAccount,
        deleteAccount:
            deps?.deleteAccount ?? deleteConnectedAccountByProvider,
        updateTokens: deps?.updateTokens ?? updateConnectedAccountTokens,
        getWorkspace: deps?.getWorkspace ?? getWorkspaceByIdForUser,
        assertQuota: deps?.assertQuota ?? assertCanCreateSource,
        createSource: deps?.createSource ?? createAndProcessSource,
        now: deps?.now ?? (() => Date.now()),
    };
}

export function getGoogleRedirectUri(): string {
    return getOAuthCallbackUrl(
        process.env.GOOGLE_REDIRECT_URI,
        OAUTH_CALLBACK_PATHS.googleDrive,
    );
}

/**
 * Generates the Google OAuth 2.0 authorization URL for read-only Google Drive access.
 *
 * @param state - Signed one-time OAuth state token
 * @returns Complete Google OAuth consent screen URL
 * @throws {ValidationError} When Google Client ID is not configured on the server
 */
export function getGoogleDriveAuthUrl(state: string): string {
    if (!GOOGLE_CLIENT_ID) {
        throw new ValidationError("Google Client ID is not configured on the server.");
    }

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: getGoogleRedirectUri(),
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
        access_type: "offline",
        prompt: "consent",
        state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Converts a provider response into an actionable, safe client error. Raw
 * provider bodies are never logged or returned because they can contain
 * authorization codes, tokens, or internal account details.
 */
async function googleProviderError(
    response: Response,
    operation: "token" | "refresh" | "list" | "metadata" | "export" | "download",
): Promise<ValidationError | NotFoundError> {
    const status = response.status;
    // Consume the body so a failed upstream response cannot leave a socket open.
    // Only a short, allowlisted provider reason code is retained; the raw body
    // may contain account details and is never logged or returned.
    let reasonCode: string | null = null;
    try {
        const body = (await response.text()).slice(0, 4096);
        const parsed = JSON.parse(body) as { error?: { reason?: unknown } };
        const reason = parsed?.error?.reason;
        if (typeof reason === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(reason)) {
            reasonCode = reason;
        }
    } catch {
        // The body is not needed for the safe, status-based message.
    }
    logger.warn("Google Drive provider request failed", {
        operation,
        status,
        reasonCode: reasonCode ?? undefined,
    });

    if (operation === "metadata" && status === 404) {
        return new NotFoundError("Google Drive file not found or inaccessible.");
    }

    if (status === 401) {
        return new ValidationError(
            "Google Drive authorization expired. Reconnect Google Drive to continue.",
            { provider: "GOOGLE_DRIVE", status },
        );
    }
    if (status === 403) {
        if (reasonCode === "insufficientPermissions" || reasonCode === "insufficient_scope") {
            return new ValidationError(
                "Google Drive needs read permission. Reconnect Google Drive and approve the requested access.",
                { provider: "GOOGLE_DRIVE", status, reasonCode },
            );
        }
        if (reasonCode === "userNotAuthenticated") {
            return new ValidationError(
                "Google Drive authorization expired. Reconnect Google Drive to continue.",
                { provider: "GOOGLE_DRIVE", status, reasonCode },
            );
        }
        return new ValidationError(
            "Google Drive access was denied. Grant read access to the file and try again.",
            { provider: "GOOGLE_DRIVE", status, reasonCode },
        );
    }
    if (status === 429) {
        return new ValidationError(
            "Google Drive is rate limiting requests. Please try again shortly.",
            { provider: "GOOGLE_DRIVE", status },
        );
    }
    if (status >= 500) {
        return new ValidationError(
            "Google Drive is temporarily unavailable. Please try again.",
            { provider: "GOOGLE_DRIVE", status },
        );
    }

    if (operation === "token" || operation === "refresh") {
        return new ValidationError(
            "Google rejected the authorization. Reconnect Google Drive to continue.",
            { provider: "GOOGLE_DRIVE", status },
        );
    }
    if (operation === "list") {
        return new ValidationError(
            "Google Drive rejected the file request. Try a shorter search or reconnect Drive.",
            { provider: "GOOGLE_DRIVE", status },
        );
    }
    if (operation === "export" || operation === "download") {
        return new ValidationError(
            "Google Drive could not export this file. Check its permissions and try again.",
            { provider: "GOOGLE_DRIVE", status },
        );
    }
    return new ValidationError("Google Drive rejected the request.", {
        provider: "GOOGLE_DRIVE",
        status,
    });
}

/**
 * Exchanges the Google OAuth authorization code for access/refresh tokens and persists the connected account.
 */
export async function handleGoogleDriveCallback({
    code,
    userId,
    deps,
}: {
    code: string;
    userId: string;
    deps?: GoogleDriveDeps;
}) {
    if (!code) {
        throw new ValidationError("Authorization code is missing.");
    }
    const resolved = resolveDeps(deps);

    const tokenRes = await resolved.fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: getGoogleRedirectUri(),
            grant_type: "authorization_code",
        }),
    });

    if (!tokenRes.ok) {
        throw await googleProviderError(tokenRes, "token");
    }

    const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
    };
    const { access_token, refresh_token, expires_in } = tokenData;
    if (!access_token) {
        throw new ValidationError("Google returned an invalid authorization response.", {
            provider: "GOOGLE_DRIVE",
        });
    }

    // Fetch user info for metadata. This is best-effort and never blocks the connection.
    let email = "Google User";
    let name = "Google Account";
    try {
        const userRes = await resolved.fetch(USERINFO_ENDPOINT, {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        if (userRes.ok) {
            const userData = (await userRes.json()) as {
                email?: string;
                name?: string;
            };
            email = userData.email || email;
            name = userData.name || name;
        }
    } catch {
        // Metadata is optional; the tokens are still usable.
    }

    const expiresAt = expires_in
        ? new Date(resolved.now() + expires_in * 1000)
        : null;

    return upsertConnectedAccountRecord({
        userId,
        provider: "GOOGLE_DRIVE",
        accessToken: access_token,
        refreshToken: refresh_token || null,
        expiresAt,
        metadata: { email, name },
    });
}

/**
 * De-duplicates concurrent refreshes for the same user so a burst of Drive
 * requests cannot consume the same refresh token repeatedly.
 */
const refreshInFlight = new Map<string, Promise<string>>();

async function refreshAccessToken(
    userId: string,
    account: { id: string; refreshToken: string | null },
    resolved: ResolvedDeps,
): Promise<string> {
    if (!account.refreshToken) {
        throw new ValidationError(
            "Google Drive access token expired and no refresh token is available. Please reconnect.",
            { provider: "GOOGLE_DRIVE" },
        );
    }

    let pending = refreshInFlight.get(userId);
    if (!pending) {
        pending = (async () => {
            const refreshRes = await resolved.fetch(TOKEN_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    refresh_token: account.refreshToken as string,
                    grant_type: "refresh_token",
                }),
            });
            if (!refreshRes.ok) {
                throw await googleProviderError(refreshRes, "refresh");
            }

            const data = (await refreshRes.json()) as {
                access_token?: string;
                expires_in?: number;
            };
            if (!data.access_token) {
                throw new ValidationError(
                    "Google returned an invalid token response. Please reconnect Google Drive.",
                    { provider: "GOOGLE_DRIVE" },
                );
            }
            const expiresAt =
                typeof data.expires_in === "number" && Number.isFinite(data.expires_in)
                    ? new Date(resolved.now() + data.expires_in * 1000)
                    : null;

            // The repository deliberately preserves the existing refresh token
            // when only accessToken/expiresAt are supplied.
            await resolved.updateTokens({
                id: account.id,
                accessToken: data.access_token,
                expiresAt,
            });
            return data.access_token;
        })();
        refreshInFlight.set(userId, pending);
    }

    try {
        return await pending;
    } finally {
        refreshInFlight.delete(userId);
    }
}

async function getValidAccessToken(
    userId: string,
    options: { forceRefresh?: boolean; deps?: GoogleDriveDeps } = {},
): Promise<string> {
    const resolved = resolveDeps(options.deps);
    const account = await resolved.findAccount(userId, "GOOGLE_DRIVE");
    if (!account) {
        throw new NotFoundError("Google Drive is not connected for this account.");
    }

    const expiresAtMs = account.expiresAt
        ? new Date(account.expiresAt).getTime()
        : null;
    const isExpired =
        expiresAtMs !== null &&
        Number.isFinite(expiresAtMs) &&
        expiresAtMs <= resolved.now() + TOKEN_EXPIRY_SKEW_MS;

    if (!options.forceRefresh && !isExpired) {
        return account.accessToken;
    }

    return refreshAccessToken(userId, account, resolved);
}

function withBearerToken(init: RequestInit | undefined, token: string): RequestInit {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return { ...init, headers };
}

/**
 * Performs a Drive API request. An unexpired token can still be revoked, so a
 * 401 triggers exactly one forced refresh and one retry.
 */
async function driveFetch(
    userId: string,
    url: string,
    init: RequestInit | undefined,
    operation: "list" | "metadata" | "export" | "download",
    resolved: ResolvedDeps,
): Promise<Response> {
    const token = await getValidAccessToken(userId, { deps: resolved });
    const response = await resolved.fetch(url, withBearerToken(init, token));
    if (response.status !== 401) {
        return response;
    }

    logger.warn("Google Drive rejected an access token; refreshing once", {
        operation,
        status: response.status,
    });
    let refreshedToken: string;
    try {
        refreshedToken = await getValidAccessToken(userId, {
            forceRefresh: true,
            deps: resolved,
        });
    } catch (refreshError) {
        // A rejected refresh token is a definitive revocation: clear the stale
        // row so status and reconnect UX reflect that the account is unusable.
        if (providerFailureStatus(refreshError) === 401) {
            logger.warn("Discarding revoked Google Drive connection", { operation });
            await resolved.deleteAccount(userId, "GOOGLE_DRIVE");
        }
        throw refreshError;
    }

    const retried = await resolved.fetch(url, withBearerToken(init, refreshedToken));
    if (retried.status === 401) {
        logger.warn("Discarding revoked Google Drive connection", { operation });
        await resolved.deleteAccount(userId, "GOOGLE_DRIVE");
    }
    return retried;
}

/**
 * Truncates before escaping. Escaping first could leave a dangling backslash
 * that escapes the closing quote and produces an invalid Drive `q` value.
 */
export function normalizeGoogleDriveSearch(search?: string | null): string {
    if (typeof search !== "string") return "";
    const bounded = Array.from(
        search.replace(/[\u0000-\u001F\u007F]/g, " ").trim(),
    )
        .slice(0, GOOGLE_DRIVE_SEARCH_MAX_CHARS)
        .join("");
    return bounded.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildGoogleDriveFileQuery(search?: string | null): string {
    const base =
        "trashed = false and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.document')";
    const escaped = normalizeGoogleDriveSearch(search);
    return escaped ? `${base} and name contains '${escaped}'` : base;
}

function normalizePageToken(pageToken?: string | null): string | undefined {
    if (typeof pageToken !== "string") return undefined;
    const token = pageToken.trim();
    if (!token) return undefined;
    if (token.length > MAX_PAGE_TOKEN_CHARS) {
        throw new ValidationError("Invalid Google Drive page token.", {
            provider: "GOOGLE_DRIVE",
        });
    }
    return token;
}

/**
 * Lists readable Google Docs and PDFs in the connected user's Google Drive.
 *
 * @returns Normalized file metadata and the opaque token for the next page, if any
 */
export async function listGoogleDriveFiles(
    userId: string,
    search?: string,
    options: { pageToken?: string; deps?: GoogleDriveDeps } = {},
) {
    const resolved = resolveDeps(options.deps);
    const url = new URL(FILES_ENDPOINT);
    url.searchParams.set("q", buildGoogleDriveFileQuery(search));
    url.searchParams.set("pageSize", String(GOOGLE_DRIVE_PAGE_SIZE));
    url.searchParams.set(
        "fields",
        "nextPageToken,files(id, name, mimeType, size, iconLink, modifiedTime, thumbnailLink, webViewLink)",
    );
    url.searchParams.set("orderBy", "modifiedTime desc");

    const pageToken = normalizePageToken(options.pageToken);
    if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
    }

    const response = await driveFetch(userId, url.toString(), undefined, "list", resolved);
    if (!response.ok) {
        throw await googleProviderError(response, "list");
    }

    const data = (await response.json()) as {
        files?: Array<Record<string, unknown>>;
        nextPageToken?: string;
    };

    const files = (Array.isArray(data.files) ? data.files : [])
        .filter((file) => typeof file.id === "string" && file.id.length > 0)
        .map((file) => {
            const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
            const rawSize = Number(file.size);
            return {
                id: file.id as string,
                name: typeof file.name === "string" ? file.name : "Untitled file",
                mimeType,
                size: Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : null,
                iconLink: typeof file.iconLink === "string" ? file.iconLink : null,
                modifiedTime:
                    typeof file.modifiedTime === "string" ? file.modifiedTime : null,
                webViewLink:
                    typeof file.webViewLink === "string" ? file.webViewLink : null,
                type: mimeType === "application/vnd.google-apps.document" ? "GOOGLE_DOC" : "PDF",
            };
        });

    return {
        files,
        nextPageToken:
            typeof data.nextPageToken === "string" && data.nextPageToken
                ? data.nextPageToken
                : null,
    };
}

function assertWithinImportLimit(byteLength: number, label: string): void {
    if (byteLength > GOOGLE_DRIVE_MAX_FILE_BYTES) {
        throw new ValidationError(
            `${label} exceeds the 25 MB Google Drive import limit.`,
            { provider: "GOOGLE_DRIVE", limitBytes: GOOGLE_DRIVE_MAX_FILE_BYTES },
        );
    }
}

/**
 * Downloads and imports a Google Doc or Google Drive PDF directly as a workspace Source.
 */
export async function importGoogleDriveFile({
    workspaceId,
    userId,
    fileId,
    deps,
}: {
    workspaceId: string;
    userId: string;
    fileId: string;
    deps?: GoogleDriveDeps;
}) {
    const resolved = resolveDeps(deps);
    const { fileId: validFileId } = importDriveFileSchema.parse({ fileId });

    // Verify workspace access and quota before contacting the provider.
    await resolved.getWorkspace(workspaceId, userId);
    await resolved.assertQuota(userId);

    const encodedFileId = encodeURIComponent(validFileId);
    const metaResponse = await driveFetch(
        userId,
        `${FILES_ENDPOINT}/${encodedFileId}?fields=id,name,mimeType,size,webViewLink`,
        undefined,
        "metadata",
        resolved,
    );
    if (!metaResponse.ok) {
        throw await googleProviderError(metaResponse, "metadata");
    }

    const fileMeta = (await metaResponse.json()) as {
        name?: string;
        mimeType?: string;
        size?: string | number;
        webViewLink?: string;
    };
    const declaredSize = Number(fileMeta.size);
    if (Number.isFinite(declaredSize) && declaredSize > GOOGLE_DRIVE_MAX_FILE_BYTES) {
        assertWithinImportLimit(declaredSize, "This file");
    }

    const title =
        typeof fileMeta.name === "string" && fileMeta.name.trim()
            ? fileMeta.name.trim().slice(0, 200)
            : "Untitled Google Drive File";
    const mimeType = fileMeta.mimeType;
    let extractedText = "";
    let sourceType: "GOOGLE_DOC" | "PDF" = "GOOGLE_DOC";

    if (mimeType === "application/vnd.google-apps.document") {
        sourceType = "GOOGLE_DOC";
        const exportResponse = await driveFetch(
            userId,
            `${FILES_ENDPOINT}/${encodedFileId}/export?mimeType=text/plain`,
            undefined,
            "export",
            resolved,
        );
        if (!exportResponse.ok) {
            throw await googleProviderError(exportResponse, "export");
        }
        const exportBuffer = await exportResponse.arrayBuffer();
        assertWithinImportLimit(exportBuffer.byteLength, "Exported Google Doc text");
        extractedText = new TextDecoder().decode(exportBuffer);
    } else if (mimeType === "application/pdf") {
        sourceType = "PDF";
        const downloadResponse = await driveFetch(
            userId,
            `${FILES_ENDPOINT}/${encodedFileId}?alt=media`,
            undefined,
            "download",
            resolved,
        );
        if (!downloadResponse.ok) {
            throw await googleProviderError(downloadResponse, "download");
        }
        const buffer = await downloadResponse.arrayBuffer();
        assertWithinImportLimit(buffer.byteLength, "This PDF");
        const { text } = await extractText(new Uint8Array(buffer));
        extractedText = Array.isArray(text) ? text.join("\n\n") : String(text || "");
    } else {
        throw new ValidationError(
            "Unsupported file type. Only Google Docs and PDFs can be imported.",
            { provider: "GOOGLE_DRIVE", mimeType: typeof mimeType === "string" ? mimeType : null },
        );
    }

    const content = extractedText.trim();
    if (!content) {
        throw new ValidationError("No readable text found in the selected file.");
    }
    assertWithinImportLimit(Buffer.byteLength(content, "utf8"), "Extracted text");

    return resolved.createSource(
        {
            workspaceId,
            type: sourceType,
            title,
            content,
            url:
                typeof fileMeta.webViewLink === "string" && fileMeta.webViewLink
                    ? fileMeta.webViewLink
                    : undefined,
            status: "PENDING",
            metadata: {
                driveFileId: validFileId,
                mimeType,
                importedAt: new Date(resolved.now()).toISOString(),
            } as Prisma.InputJsonValue,
        },
        userId,
    );
}
