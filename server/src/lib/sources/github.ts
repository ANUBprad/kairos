import { logger } from "../logger.js";
import { providerFetch } from "../provider-http.js";

const SKIP_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    "__pycache__",
    ".venv",
    "vendor",
    ".turbo",
    ".cache",
    "target",
    "bin",
    "obj",
]);

const TEXT_EXTENSIONS = new Set([
    ".md",
    ".txt",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".css",
    ".scss",
    ".html",
    ".htm",
    ".sql",
    ".rs",
    ".go",
    ".java",
    ".rb",
    ".php",
    ".swift",
    ".kt",
    ".vue",
    ".svelte",
    ".sh",
    ".bash",
    ".zsh",
    ".graphql",
    ".prisma",
    ".env.example",
    ".dockerfile",
    ".xml",
    ".csv",
    ".r",
    ".lua",
    ".dart",
    ".ex",
    ".exs",
    ".clj",
    ".hs",
    ".elm",
    ".tf",
    ".hcl",
]);

const SKIP_FILES = new Set([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "Cargo.lock",
    "Gemfile.lock",
    "poetry.lock",
    "composer.lock",
]);

export const GITHUB_MAX_FILES = 150;
export const GITHUB_MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const GITHUB_MAX_FILE_SIZE = 500 * 1024;

/** Provider calls are injectable so limits and error paths can be tested offline. */
export interface GithubFetchDeps {
    fetch?: typeof providerFetch;
}

export interface ParsedGithubRepo {
    owner: string;
    repo: string;
    branch?: string;
}

/**
 * Parses a GitHub repository URL into owner, repo, and optional branch.
 */
const REPO_SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_SEGMENT = /^[A-Za-z0-9_./@-]{1,200}$/;

export function parseGithubRepoUrl(input: string): ParsedGithubRepo | null {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 2048) return null;

    try {
        const url = new URL(trimmed);
        if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname)) {
            return null;
        }
        if (url.username || url.password || url.port) return null;

        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length < 2) return null;

        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/, "");
        if (!REPO_SEGMENT.test(owner) || !REPO_SEGMENT.test(repo)) return null;

        let branch: string | undefined;
        if (parts[2] === "tree" && parts[3]) {
            // GitHub tree paths may contain slashes in branch names.
            branch = parts.slice(3).join("/");
            if (!BRANCH_SEGMENT.test(branch)) return null;
        }

        return { owner, repo, branch };
    } catch {
        const shorthand = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
        if (shorthand && REPO_SEGMENT.test(shorthand[1]) && REPO_SEGMENT.test(shorthand[2])) {
            return { owner: shorthand[1], repo: shorthand[2] };
        }
        return null;
    }
}

function shouldIncludeFile(path: string, size?: number): boolean {
    const segments = path.split("/");
    if (segments.some((segment) => SKIP_DIRS.has(segment))) {
        return false;
    }

    const filename = segments[segments.length - 1] || path;
    if (SKIP_FILES.has(filename)) {
        return false;
    }

    if (size !== undefined && size > GITHUB_MAX_FILE_SIZE) {
        return false;
    }

    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex === -1) {
        return filename === "Dockerfile" || filename === "Makefile" || filename === "LICENSE";
    }

    const ext = filename.slice(dotIndex).toLowerCase();
    return TEXT_EXTENSIONS.has(ext);
}

export interface GithubTreeItem {
    path: string;
    sha: string;
    size?: number;
}

export interface GithubRepoInfo {
    fullName: string;
    description: string | null;
    defaultBranch: string;
    htmlUrl: string;
    isPrivate: boolean;
}

export interface GithubFileContent {
    path: string;
    content: string;
}

export class GithubApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public requiresAuth = false,
    ) {
        super(message);
        this.name = "GithubApiError";
    }
}

async function githubApiFetch<T>(
    path: string,
    token?: string,
    fetchImpl: typeof providerFetch = providerFetch,
): Promise<T> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetchImpl(`https://api.github.com${path}`, { headers });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        const requiresAuth = res.status === 401 || res.status === 403;
        let message = `GitHub API error (${res.status})`;

        if (res.status === 404) {
            message = "Repository not found or you don't have access.";
        } else if (res.status === 403) {
            message = token
                ? "GitHub access denied. The repository may be private or your token lacks permissions."
                : "GitHub rate limit reached or repository is private. Connect your GitHub account to continue.";
        } else if (res.status === 401) {
            message = "GitHub authentication failed. Please reconnect your GitHub account.";
        }

        throw new GithubApiError(message, res.status, requiresAuth);
    }

    return res.json() as Promise<T>;
}

/**
 * Fetches repository metadata from the GitHub API.
 */
export async function fetchGithubRepoInfo(
    owner: string,
    repo: string,
    options: { token?: string; deps?: GithubFetchDeps } = {},
): Promise<GithubRepoInfo> {
    if (!REPO_SEGMENT.test(owner) || !REPO_SEGMENT.test(repo)) {
        throw new GithubApiError("Invalid GitHub repository identifier.", 400);
    }
    const data = await githubApiFetch<{
        full_name: string;
        description: string | null;
        default_branch: string;
        html_url: string;
        private: boolean;
    }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        options.token,
        options.deps?.fetch,
    );

    return {
        fullName: data.full_name,
        description: data.description,
        defaultBranch: data.default_branch,
        htmlUrl: data.html_url,
        isPrivate: data.private,
    };
}

/**
 * Lists text files in a repository tree, filtered by extension and size.
 */
export async function listGithubRepoFiles(
    owner: string,
    repo: string,
    branch: string,
    options: { token?: string; deps?: GithubFetchDeps } = {},
): Promise<GithubTreeItem[]> {
    if (!REPO_SEGMENT.test(owner) || !REPO_SEGMENT.test(repo) || !BRANCH_SEGMENT.test(branch)) {
        throw new GithubApiError("Invalid GitHub repository or branch identifier.", 400);
    }
    const treeData = await githubApiFetch<{
        tree: Array<{
            path: string;
            type: string;
            sha: string;
            size?: number;
        }>;
        truncated: boolean;
    }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        options.token,
        options.deps?.fetch,
    );

    if (treeData.truncated) {
        logger.warn("GitHub tree was truncated; some files may be missing", { owner, repo });
    }

    return treeData.tree
        .filter((item) => item.type === "blob" && shouldIncludeFile(item.path, item.size))
        .map((item) => ({
            path: item.path,
            sha: item.sha,
            size: item.size,
        }))
        .sort((a, b) => (a.size ?? 0) - (b.size ?? 0))
        .slice(0, GITHUB_MAX_FILES);
}

/**
 * Fetches the decoded text content of a single blob by SHA.
 */
export async function fetchGithubBlobContent(
    owner: string,
    repo: string,
    sha: string,
    options: { token?: string; deps?: GithubFetchDeps } = {},
): Promise<string> {
    if (!REPO_SEGMENT.test(owner) || !REPO_SEGMENT.test(repo) || !/^[a-f0-9]{40}$/.test(sha)) {
        throw new GithubApiError("Invalid GitHub blob identifier.", 400);
    }
    const data = await githubApiFetch<{
        content: string;
        encoding: string;
        size: number;
    }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`,
        options.token,
        options.deps?.fetch,
    );

    if (data.encoding !== "base64") {
        return "";
    }
    const declaredSize = Number(data.size);
    if (Number.isFinite(declaredSize) && declaredSize > GITHUB_MAX_FILE_SIZE) {
        throw new GithubApiError("GitHub file exceeds the per-file import limit.", 413);
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    if (Buffer.byteLength(content, "utf-8") > GITHUB_MAX_FILE_SIZE) {
        throw new GithubApiError("GitHub file exceeds the per-file import limit.", 413);
    }
    return content;
}

/**
 * Fetches and assembles text content from all readable files in a GitHub repo.
 */
export async function fetchGithubRepoContent(
    owner: string,
    repo: string,
    options: {
        branch?: string;
        token?: string;
        deps?: GithubFetchDeps;
    } = {},
): Promise<{
    repoInfo: GithubRepoInfo;
    files: GithubFileContent[];
    markdown: string;
}> {
    const repoInfo = await fetchGithubRepoInfo(owner, repo, options);
    const branch = options.branch || repoInfo.defaultBranch;
    if (!BRANCH_SEGMENT.test(branch)) {
        throw new GithubApiError("Invalid GitHub branch identifier.", 400);
    }

    if (repoInfo.isPrivate && !options.token) {
        throw new GithubApiError(
            "This is a private repository. Connect your GitHub account to import it.",
            403,
            true,
        );
    }

    const treeItems = await listGithubRepoFiles(owner, repo, branch, options);

    if (treeItems.length === 0) {
        throw new GithubApiError(
            "No readable text files found in this repository.",
            422,
        );
    }

    const files: GithubFileContent[] = [];
    let totalBytes = 0;

    for (const item of treeItems) {
        if (files.length >= GITHUB_MAX_FILES || totalBytes >= GITHUB_MAX_TOTAL_BYTES) {
            break;
        }

        try {
            const content = await fetchGithubBlobContent(owner, repo, item.sha, options);

            if (!content.trim()) {
                continue;
            }

            const contentBytes = Buffer.byteLength(content, "utf-8");
            if (
                contentBytes > GITHUB_MAX_FILE_SIZE ||
                totalBytes + contentBytes > GITHUB_MAX_TOTAL_BYTES
            ) {
                continue;
            }

            totalBytes += contentBytes;
            files.push({ path: item.path, content });
        } catch (err) {
            logger.warn("Failed to fetch GitHub file", { path: item.path, err });
        }
    }

    if (files.length === 0) {
        throw new GithubApiError(
            "Could not extract readable text from this repository.",
            422,
        );
    }

    const header = [
        `# ${repoInfo.fullName}`,
        repoInfo.description ? `\n${repoInfo.description}` : "",
        `\nBranch: ${branch}`,
        `Files indexed: ${files.length}`,
        "",
        "---",
        "",
    ].join("\n");

    const body = files
        .map((file) => `## File: ${file.path}\n\n${file.content}`)
        .join("\n\n---\n\n");

    return {
        repoInfo,
        files,
        markdown: header + body,
    };
}
