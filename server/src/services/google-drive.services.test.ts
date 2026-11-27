import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "../types/app-error.js";
import { providerFetch } from "../lib/provider-http.js";
import {
    GOOGLE_DRIVE_MAX_FILE_BYTES,
    GOOGLE_DRIVE_SEARCH_MAX_CHARS,
    buildGoogleDriveFileQuery,
    importGoogleDriveFile,
    listGoogleDriveFiles,
    normalizeGoogleDriveSearch,
    type GoogleDriveDeps,
} from "./google-drive.services.js";

const NOW = Date.parse("2026-11-27T12:00:00.000Z");

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function fakeAccount(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: "account-1",
        userId: "user-1",
        provider: "GOOGLE_DRIVE" as const,
        accessToken: "stale-access-token",
        refreshToken: "refresh-token-value",
        expiresAt: new Date(NOW + 60_000),
        metadata: null,
        createdAt: new Date(NOW - 10_000),
        updatedAt: new Date(NOW - 10_000),
        ...overrides,
    };
}

function authHeader(init?: RequestInit): string | null {
    return new Headers(init?.headers).get("authorization");
}

describe("Google Drive integration", () => {
    it("truncates a search before escaping so the query cannot end in a dangling escape", () => {
        const quoteSearch = `${"a".repeat(GOOGLE_DRIVE_SEARCH_MAX_CHARS - 1)}'`;
        const quoteQuery = buildGoogleDriveFileQuery(quoteSearch);
        assert.ok(
            quoteQuery.endsWith(
                `and name contains '${"a".repeat(GOOGLE_DRIVE_SEARCH_MAX_CHARS - 1)}\\''`,
            ),
        );

        const slashSearch = `${"b".repeat(GOOGLE_DRIVE_SEARCH_MAX_CHARS - 1)}\\`;
        const slashQuery = buildGoogleDriveFileQuery(slashSearch);
        assert.ok(
            slashQuery.endsWith(
                `and name contains '${"b".repeat(GOOGLE_DRIVE_SEARCH_MAX_CHARS - 1)}\\\\'`,
            ),
        );

        const longSearch = "c".repeat(GOOGLE_DRIVE_SEARCH_MAX_CHARS + 80);
        assert.equal(normalizeGoogleDriveSearch(longSearch).length, GOOGLE_DRIVE_SEARCH_MAX_CHARS);
    });

    it("returns an actionable status-based error without provider details", async () => {
        const providerSecret = "raw-provider-body-must-not-escape";
        const calls: string[] = [];
        const deps = {
            now: () => NOW,
            findAccount: async () => fakeAccount(),
            fetch: (async (input: Parameters<typeof providerFetch>[0]) => {
                calls.push(String(input));
                return new Response(
                    JSON.stringify({ error: { message: providerSecret } }),
                    { status: 403, headers: { "Content-Type": "application/json" } },
                );
            }) as typeof providerFetch,
        } as unknown as GoogleDriveDeps;

        await assert.rejects(
            () => listGoogleDriveFiles("user-1", "lecture", { deps }),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                assert.match(error.message, /access was denied/i);
                assert.equal(error.message.includes(providerSecret), false);
                return true;
            },
        );
        assert.equal(calls.length, 1);
    });

    it("refreshes and retries once when Drive rejects an unexpired token", async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const updatedTokens: Array<Record<string, unknown>> = [];
        const responses = [
            new Response("token expired", { status: 401 }),
            jsonResponse({ access_token: "fresh-access-token", expires_in: 3600 }),
            jsonResponse({ files: [], nextPageToken: "page-2" }),
        ];
        const deps = {
            now: () => NOW,
            findAccount: async () => fakeAccount(),
            updateTokens: async (data: Record<string, unknown>) => {
                updatedTokens.push(data);
            },
            fetch: (async (
                input: Parameters<typeof providerFetch>[0],
                init?: RequestInit,
            ) => {
                calls.push({ url: String(input), init });
                const response = responses.shift();
                if (!response) throw new Error("unexpected extra provider call");
                return response;
            }) as typeof providerFetch,
        } as unknown as GoogleDriveDeps;

        const result = await listGoogleDriveFiles("user-1", undefined, {
            pageToken: "page-1",
            deps,
        });

        assert.equal(result.nextPageToken, "page-2");
        assert.equal(calls.length, 3, "list, refresh, retry");
        assert.equal(new URL(calls[0]!.url).searchParams.get("pageToken"), "page-1");
        assert.equal(authHeader(calls[0]!.init), "Bearer stale-access-token");
        assert.match(calls[1]!.url, /oauth2\.googleapis\.com\/token/);
        assert.equal(authHeader(calls[2]!.init), "Bearer fresh-access-token");
        assert.equal(updatedTokens.length, 1);
        assert.equal(updatedTokens[0]!.accessToken, "fresh-access-token");
        // A token refresh must never overwrite the stored refresh token.
        assert.equal("refreshToken" in updatedTokens[0]!, false);
    });

    it("rejects oversized Drive PDFs before downloading them", async () => {
        const calls: string[] = [];
        let created = false;
        const deps = {
            now: () => NOW,
            findAccount: async () => fakeAccount(),
            getWorkspace: async () => ({}),
            assertQuota: async () => undefined,
            createSource: async () => {
                created = true;
                return {};
            },
            fetch: (async (input: Parameters<typeof providerFetch>[0]) => {
                calls.push(String(input));
                return jsonResponse({
                    id: "big-file",
                    name: "huge.pdf",
                    mimeType: "application/pdf",
                    size: String(GOOGLE_DRIVE_MAX_FILE_BYTES + 1),
                });
            }) as typeof providerFetch,
        } as unknown as GoogleDriveDeps;

        await assert.rejects(
            () =>
                importGoogleDriveFile({
                    workspaceId: "workspace-1",
                    userId: "user-1",
                    fileId: "big-file",
                    deps,
                }),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                assert.match(error.message, /25 MB/);
                return true;
            },
        );
        assert.equal(calls.length, 1, "metadata only; no download");
        assert.equal(created, false);
    });
});
