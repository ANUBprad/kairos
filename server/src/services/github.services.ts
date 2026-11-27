import { getWorkspaceByIdForUser } from "./workspace.services.js";
import { assertCanCreateSource } from "./usage.services.js";
import { createAndProcessSource } from "./source.services.js";
import {
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

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

export function getGithubRedirectUri(): string {
    return getOAuthCallbackUrl(
        process.env.GITHUB_REDIRECT_URI,
        OAUTH_CALLBACK_PATHS.github,
    );
}

/**
 * Generates the GitHub OAuth authorization URL for repository read access.
 *
 * @param state - Signed one-time OAuth state token containing the user and
 * validated return path
 */
export function getGithubAuthUrl(state: string): string {
    if (!GITHUB_CLIENT_ID) {
        throw new ValidationError("GitHub Client ID is not configured on the server.");
    }

    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: getGithubRedirectUri(),
        scope: "repo read:user",
        state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges the GitHub OAuth authorization code for an access token and persists the connected account.
 */
export async function handleGithubCallback({
    code,
    userId,
}: {
    code: string;
    userId: string;
}) {
    if (!code) {
        throw new ValidationError("Authorization code is missing.");
    }

    const tokenRes = await providerFetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: getGithubRedirectUri(),
        }),
    });

    const tokenBody = await tokenRes.text();

    if (!tokenRes.ok) {
        logger.warn("GitHub token exchange failed", { status: tokenRes.status });
        throw new ValidationError("Failed to exchange GitHub authorization code.");
    }

    let tokenData: {
        access_token?: string;
        error?: string;
        error_description?: string;
    };

    try {
        tokenData = JSON.parse(tokenBody) as typeof tokenData;
    } catch {
        logger.warn("GitHub token exchange returned invalid JSON");
        throw new ValidationError("Failed to exchange GitHub authorization code.");
    }

    if (!tokenData.access_token) {
        logger.warn("GitHub token exchange returned no access token", {
            error: tokenData.error,
        });
        throw new ValidationError(
            "Failed to obtain GitHub access token. Check that the GitHub callback URL matches your OAuth app settings.",
        );
    }

    let login = "GitHub User";
    let name = "GitHub Account";
    let avatarUrl: string | undefined;

    try {
        const userRes = await providerFetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/vnd.github+json",
            },
        });
        if (userRes.ok) {
            const userData = (await userRes.json()) as {
                login?: string;
                name?: string;
                avatar_url?: string;
            };
            login = userData.login || login;
            name = userData.name || login;
            avatarUrl = userData.avatar_url;
        }
    } catch {}

    try {
        const account = await upsertConnectedAccountRecord({
            userId,
            provider: "GITHUB",
            accessToken: tokenData.access_token,
            refreshToken: null,
            expiresAt: null,
            metadata: { login, name, avatarUrl },
        });

        return account;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to save GitHub connected account", {
            error: error instanceof Error ? error.name : "UnknownError",
        });

        if (message.includes("IntegrationProvider") || message.includes("GITHUB")) {
            throw new ValidationError(
                "GitHub integration is not enabled in the database yet. Run: ALTER TYPE \"IntegrationProvider\" ADD VALUE IF NOT EXISTS 'GITHUB';",
            );
        }

        throw error;
    }
}

/**
 * Returns a GitHub access token for the user if connected, otherwise undefined.
 */
async function getOptionalAccessToken(userId: string): Promise<string | undefined> {
    const account = await findConnectedAccount(userId, "GITHUB");
    return account?.accessToken;
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

/**
 * Lists repositories for the user's connected GitHub account.
 */
export async function listUserGithubRepos(
    userId: string,
    search?: string,
): Promise<{ repos: GithubRepoItem[] }> {
    const account = await findConnectedAccount(userId, "GITHUB");
    if (!account || !account.accessToken) {
        throw new ValidationError("GitHub account is not connected. Please connect your GitHub account first.");
    }

    const response = await providerFetch(
        "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
        {
            headers: {
                Authorization: `Bearer ${account.accessToken}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "Kairos-App",
            },
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        logger.warn("Failed to fetch user repos from GitHub API", {
            status: response.status,
        });
        if (response.status === 401) {
            throw new ValidationError("GitHub token has expired or was revoked. Please reconnect GitHub in Integrations.");
        }
        throw new ValidationError("Failed to fetch repositories from GitHub.");
    }

    const data = (await response.json()) as Array<{
        id: number;
        name: string;
        full_name: string;
        owner: { login: string };
        html_url: string;
        description: string | null;
        private: boolean;
        default_branch: string;
        language: string | null;
        stargazers_count: number;
        updated_at: string;
    }>;

    let repos: GithubRepoItem[] = data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner?.login || "",
        htmlUrl: repo.html_url,
        description: repo.description,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch || "main",
        language: repo.language,
        stargazersCount: repo.stargazers_count || 0,
        updatedAt: repo.updated_at,
    }));

    if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        repos = repos.filter(
            (r) =>
                r.name.toLowerCase().includes(query) ||
                r.fullName.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query)),
        );
    }

    return { repos };
}

/**
 * Imports a GitHub repository as a workspace Source by fetching and indexing its text files.
 */
export async function importGithubRepo({
    workspaceId,
    userId,
    url,
    title,
}: {
    workspaceId: string;
    userId: string;
    url: string;
    title?: string;
}) {
    await getWorkspaceByIdForUser(workspaceId, userId);
    await assertCanCreateSource(userId);

    const parsed = parseGithubRepoUrl(url);
    if (!parsed) {
        throw new ValidationError(
            "Invalid GitHub repository URL. Use https://github.com/owner/repo",
        );
    }

    const token = await getOptionalAccessToken(userId);

    let result;
    try {
        result = await fetchGithubRepoContent(parsed.owner, parsed.repo, {
            branch: parsed.branch,
            token,
        });
    } catch (err) {
        if (err instanceof GithubApiError && err.requiresAuth && !token) {
            throw new ValidationError(
                `${err.message} Click "Connect GitHub" to authenticate.`,
            );
        }
        throw err instanceof GithubApiError
            ? new ValidationError(err.message)
            : err;
    }

    const sourceTitle = title?.trim() || result.repoInfo.fullName;

    const source = await createAndProcessSource(
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

    return source;
}
