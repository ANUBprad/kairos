import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { providerFetch } from "../provider-http.js";
import {
    GITHUB_MAX_FILES,
    GITHUB_MAX_FILE_SIZE,
    GITHUB_MAX_TOTAL_BYTES,
    fetchGithubBlobContent,
    fetchGithubRepoContent,
    parseGithubRepoUrl,
} from "./github.js";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function sha(index: number): string {
    return index.toString(16).padStart(40, "0");
}

describe("GitHub repository source helper", () => {
    it("accepts only valid GitHub repository URLs and branches", () => {
        assert.deepEqual(parseGithubRepoUrl("https://github.com/owner/repo"), {
            owner: "owner",
            repo: "repo",
            branch: undefined,
        });
        assert.deepEqual(
            parseGithubRepoUrl("https://www.github.com/owner/repo/tree/feature/docs"),
            { owner: "owner", repo: "repo", branch: "feature/docs" },
        );
        assert.deepEqual(parseGithubRepoUrl("owner/repo"), {
            owner: "owner",
            repo: "repo",
        });
        assert.equal(parseGithubRepoUrl("https://example.test/owner/repo"), null);
        assert.equal(parseGithubRepoUrl("https://github.com/owner"), null);
        assert.equal(parseGithubRepoUrl("https://github.com/../etc"), null);
    });

    it("rejects blob responses that exceed the per-file cap", async () => {
        const deps = {
            fetch: (async () =>
                jsonResponse({
                    content: Buffer.from("small").toString("base64"),
                    encoding: "base64",
                    size: GITHUB_MAX_FILE_SIZE + 1,
                })) as unknown as typeof providerFetch,
        };

        await assert.rejects(
            () =>
                fetchGithubBlobContent("owner", "repo", sha(1), {
                    deps,
                }),
            /per-file import limit/i,
        );
    });

    it("bounds file count and total bytes before assembling import markdown", async () => {
        const blobCalls: string[] = [];
        const fileContent = "x".repeat(50 * 1024);
        const tree = {
            tree: Array.from({ length: 200 }, (_, index) => ({
                path: `file-${index}.md`,
                type: "blob",
                sha: sha(index + 1),
                size: fileContent.length,
            })),
            truncated: false,
        };

        const fetchImpl = (async (input: Parameters<typeof providerFetch>[0]) => {
            const url = String(input);
            if (url.endsWith("/repos/owner/repo")) {
                return jsonResponse({
                    full_name: "owner/repo",
                    description: "docs",
                    default_branch: "main",
                    html_url: "https://github.com/owner/repo",
                    private: false,
                });
            }
            if (url.includes("/git/trees/")) {
                return jsonResponse(tree);
            }
            if (url.includes("/git/blobs/")) {
                blobCalls.push(url);
                return jsonResponse({
                    content: Buffer.from(fileContent).toString("base64"),
                    encoding: "base64",
                    size: fileContent.length,
                });
            }
            throw new Error(`unexpected GitHub URL: ${url}`);
        }) as unknown as typeof providerFetch;

        const result = await fetchGithubRepoContent("owner", "repo", {
            deps: { fetch: fetchImpl },
        });

        assert.ok(result.files.length > 0);
        assert.ok(result.files.length < GITHUB_MAX_FILES, "total byte cap stops early");
        assert.ok(blobCalls.length <= GITHUB_MAX_FILES);
        assert.ok(Buffer.byteLength(result.markdown, "utf8") < GITHUB_MAX_TOTAL_BYTES + 1_000);
    });
});
