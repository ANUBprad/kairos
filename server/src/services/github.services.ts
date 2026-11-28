import { getWorkspaceByIdForUser } from "./workspace.services.js";
import { assertCanCreateSource } from "./usage.services.js";
import { createAndProcessSource } from "./source.services.js";
import {
    deleteConnectedAccountByProvider,
    findConnectedAccount,
    upsertConnectedAccountRecord,
} from "../repository/integration.repository.js";
import {
    fetchGithubRepoContent,
    parseGithubRepoUrl,
    GithubApiError,
} from "../lib/sources/github.js";
import { ValidationError } from "../types/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { logger } from "../lib/logger.js";
import { providerFetch } from "../lib/provider-http.js";
import {
    getOAuthCallbackUrl,
    OAUTH_CALLBACK_PATHS,
} from "../lib/oauth-callback.js";
import { providerFailureStatus } from "../lib/integration-status.js";

const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const API_BASE = "https://api.github.com";

const GITHUB_AUTH_CODE = /^[A-Za-z0-9_-]{1,200}$/;
const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;
const GITHUB_SEARCH_MAX_CHARS = 200;
const DEFAULT_REPOS_PER_PAGE = 30;
const MAX_REPOS_PER_PAGE = 100;
const MAX_REPOS_PAGE = 10_000;

/**
 * Dependencies are injectable so OAuth errors, pagination, and refresh paths
 * can be exercised with mocks. Production uses the real repository and fetch.
 */
export interface GithubServiceDeps {
    fetch?: typeof providerFetch;
    findAccount?: typeof findConnectedAccount;
    deleteAccount?: typeof deleteConnectedAccountByProvider;
    upsertAccount?: typeof upsertConnectedAccountRecord;
    getWorkspace?: typeof getWorkspaceByIdForUser;
    assertQuota?: typeof assertCanCreateSource;
    createSource?: typeof createAndProcessSource;
    fetchRepoContent?: typeof fetchGithubRepoContent;
}

type ResolvedGithubDeps = {
    fetch: typeof providerFetch;
    findAccount: typeof findConnectedAccount;
    deleteAccount: typeof deleteConnectedAccountByProvider;
    upsertAccount: typeof upsertConnectedAccountRecord;
    getWorkspace: typeof getWorkspaceByIdForUser;
    assertQuota: typeof assertCanCreateSource;
    createSource: typeof createAndProcessSource;
    fetchRepoContent: typeof fetchGithubRepoContent;
};

function resolveDeps(deps?: GithubServiceDeps): ResolvedGithubDeps {
    return {
        fetch: deps?.fetch ?? providerFetch,
        findAccount: deps?.findAccount ?? findConnectedAccount,
        deleteAccount: deps?.deleteAccount ?? deleteConnectedAccountByProvider,
        upsertAccount: deps?.upsertAccount ?? upsertConnectedAccountRecord,
        getWorkspace: deps?.getWorkspace ?? getWorkspaceByIdForUser,
        assertQuota: deps?.assertQuota ?? assertCanCreateSource,
        createSource: deps?.createSource ?? createAndProcessSource,
        fetchRepoContent: deps?.fetchRepoContent ?? fetchGithubRepoContent,
    };
}

export interface GithubIntegrationConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

/**
 * The source integration deliberately uses its own OAuth app credentials.
 * Social sign-in credentials live only in Better Auth; reusing them would
 * couple two different GitHub apps and callback registrations.
 */
export function getGithubIntegrationConfig(): GithubIntegrationConfig {
    return {
        clientId: process.env.GITHUB_INTEGRATION_CLIENT_ID?.trim() || "",
        clientSecret: process.env.GITHUB_INTEGRATION_CLIENT_SECRET?.trim() || "",
        redirectUri: getOAuthCallbackUrl(
            process.env.GITHUB_INTEGRATION_REDIRECT_URI,
            OAUTH_CALLBACK_PATHS.github,
        ),
    };
}

function requireGithubIntegrationConfig(config: GithubIntegrationConfig): void {
    if (!config.clientId || !config.clientSecret) {
        throw new ValidationError(
            "GitHub integration credentials are not configured on the server.",
            { provider: "GITHUB" },
        );
    }
}

export function getGithubRedirectUri(): string {
    return getGithubIntegrationConfig().redirectUri;
}

/**
 * Generates the GitHub OAuth authorization URL for repository read access.
 *
 * @param state - Signed one-time OAuth state token containing the user and
 * validated return path
 */
export function getGithubAuthUrl(state: string): string {
    if (typeof state !== "string" || !state || state.length > 2048) {
        throw new ValidationError("Invalid OAuth state.", { provider: "GITHUB" });
    }
    const config = getGithubIntegrationConfig();
    requireGithubIntegrationConfig(config);

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: "repo read:user",
        state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Converts a provider response into a safe, actionable client error. Raw
 * provider bodies are consumed but never logged or returned.
 */
async function githubProviderError(
    response: Response,
    operation: "token" | "account" | "list" | "search",
): Promise<ValidationError> {
    const status = response.status;
    try {
        await response.text();
    } catch {
        // The body is not needed for the status-based message.
    }
    logger.warn("GitHub provider request failed", { operation, status });

    if (status === 401) {
        return new ValidationError(
            "GitHub authorization expired. Reconnect GitHub in Integrations.",
            { provider: "GITHUB", status },
        );
    }
    if (status === 403) {
        return new ValidationError(
            "GitHub access was denied or rate limited. Try again later or reconnect GitHub.",
            { provider: "GITHUB", status },
        );
    }
    if (status === 429) {
        return new ValidationError(
            "GitHub is rate limiting requests. Please try again shortly.",
            { provider: "GITHUB", status },
        );
    }
    if (status >= 500) {
        return new ValidationError(
            "GitHub is temporarily unavailable. Please try again.",
            { provider: "GITHUB", status },
        );
    }
    if (operation === "token") {
        return new ValidationError(
            "GitHub rejected the authorization. Check the registered callback and try again.",
            { provider: "GITHUB", status },
        );
    }
    if (operation === "search") {
        return new ValidationError(
            "GitHub rejected the repository search. Try a shorter search term.",
            { provider: "GITHUB", status },
        );
    }
    return new ValidationError("GitHub rejected the request. Please try again.", {
        provider: "GITHUB",
        status,
    });
}

async function readProviderJson<T>(response: Response): Promise<T> {
    try {
        return (await response.json()) as T;
    } catch {
        throw new ValidationError("GitHub returned an invalid response. Please try again.", {
            provider: "GITHUB",
        });
    }
}

function githubHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "Kairos-App",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

async function githubFetch<T>(
    url: string,
    token: string | undefined,
    resolved: ResolvedGithubDeps,
    operation: "account" | "list" | "search",
): Promise<{ data: T; response: Response }> {
    const response = await resolved.fetch(url, { headers: githubHeaders(token) });
    if (!response.ok) {
        throw await githubProviderError(response, operation);
    }
    return { data: await readProviderJson<T>(response), response };
}

/** Clears a definitively revoked token so status no longer reports connected. */
async function clearRevokedGithubAccount(
    userId: string,
    error: unknown,
    resolved: ResolvedGithubDeps,
): Promise<void> {
    if (providerFailureStatus(error) !== 401) return;
    logger.warn("Discarding revoked GitHub connection", { provider: "GITHUB" });
    await resolved.deleteAccount(userId, "GITHUB");
}

function safeMetadataString(value: unknown, fallback: string, max: number): string {
    return typeof value === "string" && value.trim()
        ? value.trim().slice(0, max)
        : fallback;
}

/**
 * Exchanges the GitHub OAuth authorization code for an access token and persists the connected account.
 */
export async function handleGithubCallback({
    code,
    userId,
    deps,
}: {
    code: string;
    userId: string;
    deps?: GithubServiceDeps;
}) {
    if (typeof code !== "string" || !GITHUB_AUTH_CODE.test(code)) {
        throw new ValidationError("Invalid GitHub authorization code.", {
            provider: "GITHUB",
        });
    }

    const resolved = resolveDeps(deps);
    const config = getGithubIntegrationConfig();
    requireGithubIntegrationConfig(config);

    const tokenRes = await resolved.fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Kairos-App",
        },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
        }),
    });

    if (!tokenRes.ok) {
        throw await githubProviderError(tokenRes, "token");
    }

    const tokenData = await readProviderJson<{
        access_token?: unknown;
        error?: unknown;
    }>(tokenRes);

    if (
        typeof tokenData.access_token !== "string" ||
        !tokenData.access_token ||
        tokenData.access_token.length > 4096
    ) {
        // Never log the provider's error body: it can contain account details.
        throw new ValidationError(
            "Failed to obtain a GitHub access token. Check the integration callback registered with GitHub.",
            { provider: "GITHUB" },
        );
    }
    const accessToken = tokenData.access_token;

    let login = "GitHub User";
    let name = "GitHub Account";
    let avatarUrl: string | undefined;

    try {
        const userRes = await resolved.fetch(USER_ENDPOINT, {
            headers: githubHeaders(accessToken),
        });
        if (userRes.ok) {
            const userData = await readProviderJson<{
                login?: unknown;
                name?: unknown;
                avatar_url?: unknown;
            }>(userRes);
            login = safeMetadataString(userData.login, login, 39);
            name = safeMetadataString(userData.name, login, 200);
            avatarUrl = safeMetadataString(userData.avatar_url, "", 500) || undefined;
        } else {
            await userRes.text().catch(() => "");
        }
    } catch {
        // Account metadata is optional; the token is still usable.
    }

    try {
        return await resolved.upsertAccount({
            userId,
            provider: "GITHUB",
            accessToken,
            refreshToken: null,
            expiresAt: null,
            metadata: { login, name, avatarUrl },
        });
    } catch (error) {
        logger.error("Failed to save GitHub connected account", {
            error: error instanceof Error ? error.name : "UnknownError",
        });

        if (error instanceof Error && /IntegrationProvider|GITHUB/.test(error.message)) {
            throw new ValidationError(
                "GitHub integration is not enabled in the database yet. Run: ALTER TYPE \"IntegrationProvider\" ADD VALUE IF NOT EXISTS 'GITHUB';",
            );
        }
        throw error;
    }
}

function isValidGithubLogin(value: unknown): value is string {
    return typeof value === "string" && GITHUB_LOGIN.test(value);
}

function readGithubLogin(metadata: unknown): string | undefined {
    if (isValidGithubLogin(metadata)) return metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
        const login = (metadata as Record<string, unknown>).login;
        if (isValidGithubLogin(login)) return login;
    }
    return undefined;
}

async function resolveAuthenticatedLogin(
    account: { accessToken: string; metadata: unknown },
    resolved: ResolvedGithubDeps,
): Promise<string> {
    const fromMetadata = readGithubLogin(account.metadata);
    if (fromMetadata) return fromMetadata;

    const { data } = await githubFetch<{ login?: unknown }>(
        USER_ENDPOINT,
        account.accessToken,
        resolved,
        "account",
    );
    const login = readGithubLogin(data.login);
    if (!login) {
        throw new ValidationError(
            "GitHub account information is unavailable. Reconnect GitHub to continue.",
            { provider: "GITHUB" },
        );
    }
    return login;
}

/**
 * Search terms are treated as plain text. Removing GitHub query qualifiers
 * prevents a client-supplied `user:` or `org:` from changing the search scope.
 */
export function normalizeGithubRepoSearch(search?: string | null): string {
    if (typeof search !== "string") return "";
    return Array.from(search.replace(/[\u0000-\u001F\u007F]/g, " ").trim())
        .slice(0, GITHUB_SEARCH_MAX_CHARS)
        .join("")
        .replace(/[:"]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function clampPage(value: unknown, fallback: number, max: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : fallback;
}

export interface GithubRepoItem {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    htmlUrl: string;
    description: string | null;
    isPrivate: boolean;
    defaultBranch: string;
    language: string | null;
    stargazersCount: number;
    updatedAt: string;
}

function safeString(value: unknown, fallback: string, max: number): string {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function safeCount(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : 0;
}

function safeGithubUrl(value: unknown, owner: string, repo: string): string {
    const fallback = `https://github.com/${owner}/${repo}`;
    if (typeof value !== "string") return fallback;
    try {
        const url = new URL(value);
        if (
            url.protocol === "https:" &&
            ["github.com", "www.github.com"].includes(url.hostname)
        ) {
            return `https://github.com${url.pathname}`;
        }
    } catch {
        // Fall back to the validated owner/repo pair.
    }
    return fallback;
}

function mapGithubRepo(raw: unknown): GithubRepoItem | null {
    if (!raw || typeof raw !== "object") return null;
    const repo = raw as Record<string, unknown>;
    const id = Number(repo.id);
    if (!Number.isSafeInteger(id) || id < 0) return null;

    const ownerRecord =
        repo.owner && typeof repo.owner === "object" && !Array.isArray(repo.owner)
            ? (repo.owner as Record<string, unknown>)
            : {};
    const owner = safeString(ownerRecord.login, "", 39);
    const name = safeString(repo.name, "", 100);
    if (!owner || !name) return null;

    const fullName = safeString(repo.full_name, `${owner}/${name}`, 300);
    return {
        id,
        name,
        fullName,
        owner,
        htmlUrl: safeGithubUrl(repo.html_url, owner, name),
        description:
            typeof repo.description === "string" && repo.description.trim()
                ? repo.description.trim().slice(0, 500)
                : null,
        isPrivate: repo.private === true,
        defaultBranch: safeString(repo.default_branch, "main", 200),
        language:
            typeof repo.language === "string" && repo.language.trim()
                ? repo.language.trim().slice(0, 100)
                : null,
        stargazersCount: safeCount(repo.stargazers_count),
        updatedAt: safeString(repo.updated_at, "", 50),
    };
}

/** Reads the next GitHub page from the RFC 5988 Link header. */
export function parseGithubNextPage(linkHeader: string | null, currentPage: number): number | null {
    if (!linkHeader) return null;
    const match = /<[^>]*[?&]page=(\d+)[^>]*>\s*;\s*rel="next"/.exec(linkHeader);
    if (!match) return null;
    const nextPage = Number(match[1]);
    return Number.isInteger(nextPage) && nextPage > currentPage && nextPage <= MAX_REPOS_PAGE
        ? nextPage
        : null;
}

export interface ListGithubReposOptions {
    search?: string;
    page?: number;
    perPage?: number;
    deps?: GithubServiceDeps;
}

/**
 * Lists repositories visible to the connected GitHub account, including
 * private repos, with bounded pagination and server-side search.
 */
export async function listUserGithubRepos(
    userId: string,
    options: ListGithubReposOptions = {},
): Promise<{
    repos: GithubRepoItem[];
    nextPage: number | null;
    hasMore: boolean;
    totalCount?: number;
}> {
    const resolved = resolveDeps(options.deps);
    const account = await resolved.findAccount(userId, "GITHUB");
    if (!account || !account.accessToken) {
        throw new ValidationError(
            "GitHub account is not connected. Please connect your GitHub account first.",
            { provider: "GITHUB" },
        );
    }

    const page = clampPage(options.page, 1, MAX_REPOS_PAGE);
    const perPage = clampPage(options.perPage, DEFAULT_REPOS_PER_PAGE, MAX_REPOS_PER_PAGE);
    const search = normalizeGithubRepoSearch(options.search);
    const url = new URL(search ? `${API_BASE}/search/repositories` : `${API_BASE}/user/repos`);

    if (search) {
        try {
            const login = await resolveAuthenticatedLogin(account, resolved);
            url.searchParams.set("q", `${search} user:${login}`);
        } catch (error) {
            await clearRevokedGithubAccount(userId, error, resolved);
            throw error;
        }
        url.searchParams.set("sort", "updated");
        url.searchParams.set("order", "desc");
    } else {
        url.searchParams.set("affiliation", "owner,collaborator,organization_member");
        url.searchParams.set("visibility", "all");
        url.searchParams.set("sort", "updated");
        url.searchParams.set("direction", "desc");
    }
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    let data: unknown;
    let response: Response;
    try {
        ({ data, response } = await githubFetch<unknown>(
            url.toString(),
            account.accessToken,
            resolved,
            search ? "search" : "list",
        ));
    } catch (error) {
        await clearRevokedGithubAccount(userId, error, resolved);
        throw error;
    }

    const rawItems = Array.isArray(data)
        ? data
        : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: unknown[] }).items
          : [];
    const repos = rawItems
        .map(mapGithubRepo)
        .filter((repo): repo is GithubRepoItem => repo !== null);

    const nextPage = parseGithubNextPage(response.headers.get("link"), page);
    const totalCountRaw =
        data && typeof data === "object" && !Array.isArray(data)
            ? (data as { total_count?: unknown }).total_count
            : undefined;
    const totalCount =
        typeof totalCountRaw === "number" && Number.isFinite(totalCountRaw)
            ? totalCountRaw
            : undefined;

    return { repos, nextPage, hasMore: nextPage !== null, totalCount };
}

/**
 * Imports a GitHub repository as a workspace Source by fetching and indexing its text files.
 */
export async function importGithubRepo({
    workspaceId,
    userId,
    url,
    title,
    deps,
}: {
    workspaceId: string;
    userId: string;
    url: string;
    title?: string;
    deps?: GithubServiceDeps;
}) {
    const resolved = resolveDeps(deps);
    await resolved.getWorkspace(workspaceId, userId);
    await resolved.assertQuota(userId);

    const parsed = parseGithubRepoUrl(url);
    if (!parsed) {
        throw new ValidationError(
            "Invalid GitHub repository URL. Use https://github.com/owner/repo",
        );
    }

    const account = await resolved.findAccount(userId, "GITHUB");
    const token = account?.accessToken;

    let result;
    try {
        result = await resolved.fetchRepoContent(parsed.owner, parsed.repo, {
            branch: parsed.branch,
            token,
            deps: { fetch: resolved.fetch },
        });
    } catch (err) {
        if (err instanceof GithubApiError && err.requiresAuth && !token) {
            throw new ValidationError(
                `${err.message} Click "Connect GitHub" to authenticate.`,
            );
        }
        throw err instanceof GithubApiError ? new ValidationError(err.message) : err;
    }

    const sourceTitle = (title?.trim() || result.repoInfo.fullName).slice(0, 200);

    return resolved.createSource(
        {
            workspaceId,
            type: "GITHUB_REPO",
            title: sourceTitle,
            content: result.markdown,
            url: result.repoInfo.htmlUrl,
            status: "PENDING",
            metadata: {
                owner: parsed.owner,
                repo: parsed.repo,
                branch: parsed.branch || result.repoInfo.defaultBranch,
                fileCount: result.files.length,
                isPrivate: result.repoInfo.isPrivate,
                importedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
        },
        userId,
    );
}
