import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { providerFetch } from "../lib/provider-http.js";
import { GithubApiError } from "../lib/sources/github.js";
import { ValidationError } from "../types/app-error.js";
import {
    getGithubAuthUrl,
    handleGithubCallback,
    importGithubRepo,
    listUserGithubRepos,
    normalizeGithubRepoSearch,
    type GithubServiceDeps,
} from "./github.services.js";

const ENV_KEYS = [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_INTEGRATION_CLIENT_ID",
    "GITHUB_INTEGRATION_CLIENT_SECRET",
    "GITHUB_INTEGRATION_REDIRECT_URI",
] as const;

const originalEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

function setIntegrationEnv(): void {
    process.env.GITHUB_CLIENT_ID = "social-client-id";
    process.env.GITHUB_CLIENT_SECRET = "social-client-secret";
    process.env.GITHUB_INTEGRATION_CLIENT_ID = "integration-client-id";
    process.env.GITHUB_INTEGRATION_CLIENT_SECRET = "integration-client-secret";
    process.env.GITHUB_INTEGRATION_REDIRECT_URI =
        "https://api.example.test/api/integrations/github/callback";
}

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

function fakeAccount(overrides: Record<string, unknown> = {}) {
    return {
        id: "account-1",
        userId: "user-1",
        provider: "GITHUB" as const,
        accessToken: "connected-access-token",
        refreshToken: null,
        expiresAt: null,
        metadata: { login: "octocat", name: "Octo Cat" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        ...overrides,
    };
}

function bearerToken(init?: RequestInit): string | null {
    return new Headers(init?.headers).get("authorization");
}

describe("GitHub integration", () => {
    beforeEach(() => {
        setIntegrationEnv();
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            const original = originalEnv.get(key);
            if (original === undefined) delete process.env[key];
            else process.env[key] = original;
        }
    });

    it("uses integration-only credentials and callback for OAuth", async () => {
        const authUrl = new URL(getGithubAuthUrl("signed-state"));
        assert.equal(authUrl.searchParams.get("client_id"), "integration-client-id");
        assert.equal(
            authUrl.searchParams.get("redirect_uri"),
            "https://api.example.test/api/integrations/github/callback",
        );
        assert.match(authUrl.searchParams.get("scope") || "", /repo/);
        assert.equal(authUrl.searchParams.get("state"), "signed-state");

        const requests: Array<{ url: string; init?: RequestInit }> = [];
        const responses = [
            jsonResponse({ access_token: "github-access-token" }),
            jsonResponse({
                login: "octocat",
                name: "Octo Cat",
                avatar_url: "https://avatars.example.test/octocat.png",
            }),
        ];
        const upserted: Array<Record<string, unknown>> = [];
        const deps = {
            fetch: (async (
                input: Parameters<typeof providerFetch>[0],
                init?: RequestInit,
            ) => {
                requests.push({ url: String(input), init });
                const response = responses.shift();
                if (!response) throw new Error("unexpected provider call");
                return response;
            }) as typeof providerFetch,
            upsertAccount: async (data: Record<string, unknown>) => {
                upserted.push(data);
                return fakeAccount();
            },
        } as unknown as GithubServiceDeps;

        await handleGithubCallback({ code: "valid-code_123", userId: "user-1", deps });

        const tokenRequest = requests[0]!;
        const body = JSON.parse(String(tokenRequest.init?.body)) as Record<string, unknown>;
        assert.equal(body.client_id, "integration-client-id");
        assert.equal(body.client_secret, "integration-client-secret");
        assert.equal(
            body.redirect_uri,
            "https://api.example.test/api/integrations/github/callback",
        );
        const serializedBody = JSON.stringify(body);
        assert.equal(serializedBody.includes("social-client-id"), false);
        assert.equal(serializedBody.includes("social-client-secret"), false);
        assert.equal(upserted.length, 1);
        assert.equal(upserted[0]!.accessToken, "github-access-token");
    });

    it("rejects invalid codes and never reflects provider error details", async () => {
        await assert.rejects(
            () =>
                handleGithubCallback({
                    code: "not a code",
                    userId: "user-1",
                    deps: {} as GithubServiceDeps,
                }),
            /Invalid GitHub authorization code/,
        );

        const providerSecret = "provider-error-detail-must-not-escape";
        const deps = {
            fetch: (async () =>
                new Response(
                    JSON.stringify({
                        error: "bad_verification_code",
                        error_description: providerSecret,
                    }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                )) as typeof providerFetch,
        } as unknown as GithubServiceDeps;

        await assert.rejects(
            () => handleGithubCallback({ code: "valid-code", userId: "user-1", deps }),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                assert.match(error.message, /registered callback/i);
                assert.equal(
                    `${error.message} ${JSON.stringify(error.details)}`.includes(providerSecret),
                    false,
                );
                return true;
            },
        );
    });

    it("normalizes search qualifiers and returns private search results with pagination", async () => {
        assert.equal(normalizeGithubRepoSearch("octo: docs"), "octo docs");

        const requests: Array<{ url: string; init?: RequestInit }> = [];
        const result = jsonResponse(
            {
                total_count: 1,
                items: [
                    {
                        id: 10,
                        name: "notes",
                        full_name: "octocat/notes",
                        owner: { login: "octocat" },
                        html_url: "https://github.com/octocat/notes",
                        description: "Private study notes",
                        private: true,
                        default_branch: "main",
                        language: "TypeScript",
                        stargazers_count: 3,
                        updated_at: "2026-11-01T00:00:00Z",
                    },
                ],
            },
            200,
            {
                Link: '<https://api.github.com/search/repositories?q=docs&page=3>; rel="next"',
            },
        );
        const deps = {
            findAccount: async () => fakeAccount(),
            fetch: (async (
                input: Parameters<typeof providerFetch>[0],
                init?: RequestInit,
            ) => {
                requests.push({ url: String(input), init });
                return result;
            }) as typeof providerFetch,
        } as unknown as GithubServiceDeps;

        const data = await listUserGithubRepos("user-1", {
            search: "octo: docs",
            page: 2,
            perPage: 10,
            deps,
        });

        assert.equal(requests.length, 1, "metadata login avoids an extra account call");
        const url = new URL(requests[0]!.url);
        assert.equal(url.pathname, "/search/repositories");
        assert.equal(url.searchParams.get("q"), "octo docs user:octocat");
        assert.equal(url.searchParams.get("page"), "2");
        assert.equal(url.searchParams.get("per_page"), "10");
        assert.equal(bearerToken(requests[0]!.init), "Bearer connected-access-token");
        assert.equal(data.nextPage, 3);
        assert.equal(data.hasMore, true);
        assert.equal(data.repos[0]!.isPrivate, true);
        assert.equal(data.repos[0]!.fullName, "octocat/notes");
    });

    it("lists private and organization repos from the accessible repository endpoint", async () => {
        const requests: Array<{ url: string }> = [];
        const deps = {
            findAccount: async () => fakeAccount(),
            fetch: (async (input: Parameters<typeof providerFetch>[0]) => {
                requests.push({ url: String(input) });
                return jsonResponse([
                    {
                        id: 11,
                        name: "internal",
                        full_name: "team/internal",
                        owner: { login: "team" },
                        html_url: "https://github.com/team/internal",
                        description: null,
                        private: true,
                        default_branch: "develop",
                        language: null,
                        stargazers_count: 0,
                        updated_at: "2026-11-02T00:00:00Z",
                    },
                ]);
            }) as typeof providerFetch,
        } as unknown as GithubServiceDeps;

        const data = await listUserGithubRepos("user-1", {
            page: 3,
            perPage: 30,
            deps,
        });

        const url = new URL(requests[0]!.url);
        assert.equal(url.pathname, "/user/repos");
        assert.equal(url.searchParams.get("visibility"), "all");
        assert.match(
            url.searchParams.get("affiliation") || "",
            /owner,collaborator,organization_member/,
        );
        assert.equal(url.searchParams.get("page"), "3");
        assert.equal(url.searchParams.get("per_page"), "30");
        assert.equal(data.nextPage, null);
        assert.equal(data.repos[0]!.isPrivate, true);
        assert.equal(data.repos[0]!.defaultBranch, "develop");
    });

    it("maps GitHub API failures to safe actionable errors", async () => {
        const providerSecret = "upstream-account-detail";
        const deps = {
            findAccount: async () => fakeAccount(),
            fetch: (async () =>
                new Response(JSON.stringify({ message: providerSecret }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" },
                })) as typeof providerFetch,
        } as unknown as GithubServiceDeps;

        await assert.rejects(
            () => listUserGithubRepos("user-1", { deps }),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                assert.match(error.message, /access was denied|rate limited/i);
                assert.equal(error.message.includes(providerSecret), false);
                return true;
            },
        );
    });

    it("clears a revoked GitHub token after a 401 repository response", async () => {
        const deleted: Array<[string, string]> = [];
        const deps = {
            findAccount: async () => fakeAccount(),
            deleteAccount: async (userId: string, provider: string) => {
                deleted.push([userId, provider]);
                return { count: 1 };
            },
            fetch: (async () =>
                new Response(JSON.stringify({ message: "Bad credentials" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                })) as typeof providerFetch,
        } as unknown as GithubServiceDeps;

        await assert.rejects(
            () => listUserGithubRepos("user-1", { deps }),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                assert.match(error.message, /reconnect/i);
                return true;
            },
        );
        assert.deepEqual(deleted, [["user-1", "GITHUB"]]);
    });

    it("imports a private repo with the connected token and never leaks it", async () => {
        let capturedToken: string | undefined;
        const created: Array<Record<string, unknown>> = [];
        const deps = {
            getWorkspace: async () => ({}),
            assertQuota: async () => undefined,
            findAccount: async () => fakeAccount({ accessToken: "private-repo-token" }),
            fetchRepoContent: async (
                _owner: string,
                _repo: string,
                options: { token?: string },
            ) => {
                capturedToken = options.token;
                return {
                    repoInfo: {
                        fullName: "owner/private",
                        description: "private docs",
                        defaultBranch: "main",
                        htmlUrl: "https://github.com/owner/private",
                        isPrivate: true,
                    },
                    files: [{ path: "README.md", content: "# Private" }],
                    markdown: "# owner/private\n\n# Private",
                };
            },
            createSource: async (data: Record<string, unknown>) => {
                created.push(data);
                return { id: "source-1" };
            },
        } as unknown as GithubServiceDeps;

        const source = await importGithubRepo({
            workspaceId: "workspace-1",
            userId: "user-1",
            url: "https://github.com/owner/private",
            title: "Private docs",
            deps,
        });

        assert.deepEqual(source, { id: "source-1" });
        assert.equal(capturedToken, "private-repo-token");
        assert.equal(created.length, 1);
        assert.equal(created[0]!.type, "GITHUB_REPO");
        const metadata = created[0]!.metadata as Record<string, unknown>;
        assert.equal(metadata.isPrivate, true);
        assert.equal(metadata.fileCount, 1);
    });

    it("does not create a source when the repository exceeds import caps", async () => {
        let created = false;
        const deps = {
            getWorkspace: async () => ({}),
            assertQuota: async () => undefined,
            findAccount: async () => fakeAccount(),
            fetchRepoContent: async () => {
                throw new GithubApiError("GitHub file exceeds the per-file import limit.", 413);
            },
            createSource: async () => {
                created = true;
                return {};
            },
        } as unknown as GithubServiceDeps;

        await assert.rejects(
            () =>
                importGithubRepo({
                    workspaceId: "workspace-1",
                    userId: "user-1",
                    url: "https://github.com/owner/huge",
                    deps,
                }),
            /per-file import limit/i,
        );
        assert.equal(created, false);
    });
});
