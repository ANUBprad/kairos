import type { Request, Response } from "express";
import {
    deleteConnectedAccountByProvider,
    findConnectedAccountsByUserId,
} from "../repository/integration.repository.js";
import {
    getGoogleDriveAuthUrl,
    handleGoogleDriveCallback,
    listGoogleDriveFiles,
    importGoogleDriveFile,
} from "../services/google-drive.services.js";
import {
    getNotionAuthUrl,
    connectNotionWithToken,
    handleNotionOAuthCallback,
    listNotionPages,
    importNotionPage,
    exportArtifactToNotion,
} from "../services/notion.services.js";
import {
    getGithubAuthUrl,
    handleGithubCallback,
    importGithubRepo,
    listUserGithubRepos,
} from "../services/github.services.js";
import {
    clearOAuthStateCookie,
    getPrimaryClientUrl,
    issueOAuthState,
    readOAuthStateCookie,
    setOAuthStateCookie,
    validateReturnPath,
    verifyOAuthState,
} from "../lib/oauth-state.js";
import { logger } from "../lib/logger.js";
import { hasUsableIntegrationToken } from "../lib/integration-status.js";

/**
 * Clears the single-use state cookie BEFORE ending the response.
 *
 * `res.redirect()` calls `res.end()`, so calling `clearOAuthStateCookie()` in a
 * `finally` block afterwards failed with "Cannot set headers after they are
 * sent" and left the nonce cookie in the browser. The database nonce is still
 * single-use, but a stale cookie is confusing and caused unhandled errors.
 */
function redirectClearingState(
    res: Response,
    provider: "GOOGLE_DRIVE" | "NOTION" | "GITHUB",
    url: string,
): void {
    clearOAuthStateCookie(res, provider);
    res.redirect(url);
}

/** Builds a same-origin return URL for integration callbacks. */
function getIntegrationCallbackRedirect(
    returnTo: string | null,
    params: Record<string, string>,
): string {
    const target = new URL(
        validateReturnPath(returnTo ?? "/settings/integrations"),
        getPrimaryClientUrl(),
    );
    for (const [key, value] of Object.entries(params)) {
        target.searchParams.set(key, value);
    }
    return target.toString();
}

const OAUTH_DENIED_CODES = new Set([
    "access_denied",
    "user_denied",
    "cancelled",
    "canceled",
]);

export type IntegrationCallbackCode =
    | "access_denied"
    | "invalid_scope"
    | "invalid_code"
    | "oauth_failed"
    | "oauth_state_invalid"
    | "callback_failed";

/**
 * Provider `error_description` is deliberately discarded: it can contain
 * account details or internal URLs. The browser only receives a fixed code
 * that the client maps to a sanitized, provider-specific message.
 */
export function providerCallbackCode(code: unknown): IntegrationCallbackCode | null {
    if (typeof code !== "string") return null;
    const normalized = code.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,64}$/.test(normalized)) return null;
    if (OAUTH_DENIED_CODES.has(normalized)) return "access_denied";
    if (normalized === "invalid_scope") return "invalid_scope";
    return "oauth_failed";
}

import {
    connectNotionSchema,
    exportNotionSchema,
    importDriveFileSchema,
    importNotionPageSchema,
    importGithubRepoSchema,
    listDriveFilesQuerySchema,
    listGithubReposQuerySchema,
} from "../validators/integration.validator.js";
import { getZodFieldErrors } from "../utils/zod-error.js";
import { workspaceIdParamSchema } from "../validators/workspace.validator.js";
import { artifactIdParamSchema } from "../validators/artifact.validator.js";
import { ValidationError } from "../types/app-error.js";
import type {
    ConnectedAccount,
    IntegrationProvider,
} from "../generated/prisma/client.js";

/** Public connected-account shape. Never includes accessToken/refreshToken. */
export type ConnectedAccountDto = Pick<
    ConnectedAccount,
    "id" | "provider" | "metadata" | "createdAt" | "updatedAt"
>;

/**
 * Builds an explicit response DTO so persisted provider credentials can never
 * leak to clients through a serialized database row.
 */
export function toConnectedAccountDto(
    account: ConnectedAccountDto,
): ConnectedAccountDto {
    return {
        id: account.id,
        provider: account.provider,
        metadata: account.metadata,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
    };
}

type StatusAccount = Pick<
    ConnectedAccount,
    "provider" | "expiresAt" | "refreshToken" | "id" | "metadata" | "createdAt" | "updatedAt"
>;

/** A stale row is reported as disconnected with an explicit reconnect hint. */
function providerStatus(accounts: StatusAccount[], provider: IntegrationProvider) {
    const account = accounts.find((row) => row.provider === provider);
    const connected = hasUsableIntegrationToken(account);
    return {
        connected,
        needsReconnect: Boolean(account) && !connected,
        account: account ? toConnectedAccountDto(account) : null,
    };
}

/**
 * Handles HTTP GET request to list all connected third-party accounts (Google Drive, Notion) for the current user.
 *
 * @param req - Express request with authenticated session user
 * @param res - Express response returning connection status per provider
 */
export async function getConnectedIntegrations(req: Request, res: Response) {
    const accounts = await findConnectedAccountsByUserId(req.session.user.id);

    res.json({
        googleDrive: providerStatus(accounts, "GOOGLE_DRIVE"),
        notion: providerStatus(accounts, "NOTION"),
        github: providerStatus(accounts, "GITHUB"),
    });
}

/**
 * Handles HTTP DELETE request to disconnect a third-party integration provider.
 *
 * @param req - Express request with provider name in params
 * @param res - Express response confirming disconnection
 */
export async function disconnectIntegration(req: Request, res: Response) {
    const { provider } = req.params;
    const provUpper = String(provider || "").toUpperCase().replace("-", "_") as IntegrationProvider;

    await deleteConnectedAccountByProvider(req.session.user.id, provUpper);

    res.json({ success: true });
}

// ---------------- Google Drive Handlers ----------------

/**
 * Handles HTTP GET request to retrieve the Google OAuth authorization URL.
 *
 * @param req - Express request with session user
 * @param res - Express response returning { url: string }
 */
export async function getGoogleDriveAuth(req: Request, res: Response) {
    const issued = await issueOAuthState({
        userId: req.session.user.id,
        provider: "GOOGLE_DRIVE",
        returnTo: req.query.returnTo,
    });
    setOAuthStateCookie(res, "GOOGLE_DRIVE", issued.nonce);
    const url = getGoogleDriveAuthUrl(issued.token);
    res.json({ url });
}

/**
 * Handles HTTP GET callback from Google OAuth redirect, stores tokens, and redirects user back to UI.
 * Identity comes only from a signed, single-use state bound to an HTTP-only cookie.
 */
export async function googleDriveCallback(req: Request, res: Response) {
    let returnTo: string | null = null;
    let stateVerified = false;
    try {
        const verified = await verifyOAuthState({
            token: req.query.state,
            cookieNonce: readOAuthStateCookie(req, "GOOGLE_DRIVE"),
            provider: "GOOGLE_DRIVE",
        });
        returnTo = verified.returnTo;
        stateVerified = true;

        const { code, error } = req.query;
        if (typeof error === "string" && error.trim()) {
            redirectClearingState(
                res,
                "GOOGLE_DRIVE",
                getIntegrationCallbackRedirect(returnTo, {
                    google_drive_error: providerCallbackCode(error) ?? "oauth_failed",
                }),
            );
            return;
        }

        const trimmedCode = typeof code === "string" ? code.trim() : "";
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(trimmedCode)) {
            redirectClearingState(
                res,
                "GOOGLE_DRIVE",
                getIntegrationCallbackRedirect(returnTo, {
                    google_drive_error: "invalid_code",
                }),
            );
            return;
        }

        await handleGoogleDriveCallback({ code: trimmedCode, userId: verified.userId });
        redirectClearingState(
            res,
            "GOOGLE_DRIVE",
            getIntegrationCallbackRedirect(returnTo, { connected: "google-drive" }),
        );
    } catch (error) {
        logger.warn("Google Drive OAuth callback rejected", {
            reason: error instanceof Error ? error.name : "UnknownError",
        });
        redirectClearingState(
            res,
            "GOOGLE_DRIVE",
            getIntegrationCallbackRedirect(returnTo, {
                google_drive_error: stateVerified ? "callback_failed" : "oauth_state_invalid",
            }),
        );
    }
}

/**
 * Handles HTTP GET request to list Google Docs and PDFs from the connected Google Drive.
 *
 * @param req - Express request with optional search term in query
 * @param res - Express response returning matching Google Drive files
 */
export async function listDriveFiles(req: Request, res: Response) {
    const parsed = listDriveFilesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        throw new ValidationError("Invalid Google Drive query", getZodFieldErrors(parsed.error));
    }
    const data = await listGoogleDriveFiles(
        req.session.user.id,
        parsed.data.search,
        { pageToken: parsed.data.pageToken },
    );
    res.json(data);
}

/**
 * Handles HTTP POST request to import a selected Google Drive file as a workspace Source.
 *
 * @param req - Express request with workspaceId param and fileId in body
 * @param res - Express response returning 201 Created with source record
 */
export async function importDriveFile(req: Request, res: Response) {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const { fileId } = importDriveFileSchema.parse(req.body);

    const source = await importGoogleDriveFile({
        workspaceId,
        userId: req.session.user.id,
        fileId,
    });

    res.status(201).json(source);
}

// ---------------- Notion Handlers ----------------

/**
 * Handles HTTP GET request to retrieve the Notion OAuth authorization URL.
 *
 * @param req - Express request with session user
 * @param res - Express response returning { url: string }
 */
export async function getNotionAuth(req: Request, res: Response) {
    const issued = await issueOAuthState({
        userId: req.session.user.id,
        provider: "NOTION",
    });
    setOAuthStateCookie(res, "NOTION", issued.nonce);
    const url = getNotionAuthUrl(issued.token);
    res.json({ url });
}

/**
 * Handles HTTP POST request to connect a Notion workspace via an internal integration token.
 *
 * @param req - Express request with integration token in body
 * @param res - Express response returning the safe connected-account DTO
 */
export async function connectNotionToken(req: Request, res: Response) {
    const { token } = connectNotionSchema.parse(req.body);
    const account = await connectNotionWithToken({
        userId: req.session.user.id,
        token,
    });
    res.json({ success: true, account: toConnectedAccountDto(account) });
}

/**
 * Handles HTTP GET callback from Notion OAuth redirect, stores tokens, and redirects user to UI.
 *
 * @param req - Express request with OAuth code and state in query
 * @param res - Express response redirecting to frontend settings
 * @throws {ValidationError} When code or user session state is missing
 */
export async function notionOAuthCallback(req: Request, res: Response) {
    try {
        const verified = await verifyOAuthState({
            token: req.query.state,
            cookieNonce: readOAuthStateCookie(req, "NOTION"),
            provider: "NOTION",
        });
        const code = req.query.code;
        if (typeof code !== "string" || !code.trim()) {
            throw new ValidationError("Missing Notion authorization code.");
        }

        await handleNotionOAuthCallback({ code: code.trim(), userId: verified.userId });
        redirectClearingState(
            res,
            "NOTION",
            `${getPrimaryClientUrl()}/settings/integrations?connected=notion`,
        );
    } catch (error) {
        logger.warn("Notion OAuth callback rejected", {
            reason: error instanceof Error ? error.name : "UnknownError",
        });
        redirectClearingState(
            res,
            "NOTION",
            `${getPrimaryClientUrl()}/settings/integrations?error=oauth_invalid_state`,
        );
    }
}

/**
 * Handles HTTP GET request to list accessible Notion pages and databases.
 *
 * @param req - Express request with optional query search string
 * @param res - Express response returning Notion pages
 */
export async function listPages(req: Request, res: Response) {
    const { search } = req.query;
    const data = await listNotionPages(
        req.session.user.id,
        search ? String(search) : undefined,
    );
    res.json(data);
}

/**
 * Handles HTTP POST request to import a Notion page as a workspace Source document.
 *
 * @param req - Express request with workspaceId param and pageId in body
 * @param res - Express response returning 201 Created with source record
 */
export async function importPage(req: Request, res: Response) {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const { pageId } = importNotionPageSchema.parse(req.body);

    const source = await importNotionPage({
        workspaceId,
        userId: req.session.user.id,
        pageId,
    });

    res.status(201).json(source);
}

/**
 * Handles HTTP POST request to export a generated learning artifact to a Notion workspace page.
 *
 * @param req - Express request with workspaceId, artifactId, and optional parentPageId
 * @param res - Express response returning created Notion page URL and ID
 */
export async function exportToNotion(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    const { parentPageId } = exportNotionSchema.parse(req.body);

    const result = await exportArtifactToNotion({
        workspaceId,
        artifactId,
        userId: req.session.user.id,
        parentPageId,
    });

    res.json(result);
}

// ---------------- GitHub Handlers ----------------

/**
 * Handles HTTP GET request to retrieve the GitHub OAuth authorization URL.
 */
export async function getGithubAuth(req: Request, res: Response) {
    const issued = await issueOAuthState({
        userId: req.session.user.id,
        provider: "GITHUB",
        returnTo: req.query.returnTo,
    });
    setOAuthStateCookie(res, "GITHUB", issued.nonce);
    const url = getGithubAuthUrl(issued.token);
    res.json({ url });
}

/** Handles the GitHub OAuth callback with signed single-use state verification. */
export async function githubCallback(req: Request, res: Response) {
    try {
        const verified = await verifyOAuthState({
            token: req.query.state,
            cookieNonce: readOAuthStateCookie(req, "GITHUB"),
            provider: "GITHUB",
        });

        const { code, error } = req.query;
        if (typeof error === "string" && error.trim()) {
            // Never reflect provider-supplied error_description: it can contain
            // account details and is not needed for a safe retry message.
            redirectClearingState(
                res,
                "GITHUB",
                getIntegrationCallbackRedirect(verified.returnTo, {
                    github_error: providerCallbackCode(error) ?? "oauth_failed",
                }),
            );
            return;
        }

        const trimmedCode = typeof code === "string" ? code.trim() : "";
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(trimmedCode)) {
            redirectClearingState(
                res,
                "GITHUB",
                getIntegrationCallbackRedirect(verified.returnTo, {
                    github_error: "invalid_code",
                }),
            );
            return;
        }

        try {
            await handleGithubCallback({ code: trimmedCode, userId: verified.userId });
        } catch (callbackError) {
            logger.warn("GitHub integration callback failed", {
                reason:
                    callbackError instanceof Error
                        ? callbackError.name
                        : "UnknownError",
            });
            redirectClearingState(
                res,
                "GITHUB",
                getIntegrationCallbackRedirect(verified.returnTo, {
                    github_error: "oauth_failed",
                }),
            );
            return;
        }

        redirectClearingState(
            res,
            "GITHUB",
            getIntegrationCallbackRedirect(verified.returnTo, {
                connected: "github",
            }),
        );
    } catch (error) {
        logger.warn("GitHub OAuth callback rejected", {
            reason: error instanceof Error ? error.name : "UnknownError",
        });
        redirectClearingState(
            res,
            "GITHUB",
            getIntegrationCallbackRedirect("/settings/integrations", {
                github_error: "oauth_state_invalid",
            }),
        );
    }
}

/**
 * Handles HTTP POST request to import a GitHub repository as a workspace Source.
 */
export async function importGithub(req: Request, res: Response) {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const { url, title } = importGithubRepoSchema.parse(req.body);

    const source = await importGithubRepo({
        workspaceId,
        userId: req.session.user.id,
        url,
        title,
    });

    res.status(201).json(source);
}

/**
 * Handles HTTP GET request to list repositories for the connected GitHub account.
 */
export async function listGithubRepos(req: Request, res: Response) {
    const parsed = listGithubReposQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        throw new ValidationError(
            "Invalid GitHub repository query",
            getZodFieldErrors(parsed.error),
        );
    }
    const data = await listUserGithubRepos(req.session.user.id, {
        search: parsed.data.search,
        page: parsed.data.page,
        perPage: parsed.data.perPage,
    });
    res.json(data);
}
