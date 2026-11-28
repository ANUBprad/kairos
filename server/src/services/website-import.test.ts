import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "../types/app-error.js";
import { importWebsiteSource, type WebsiteImportDeps } from "./source.services.js";

const VALID_URL = "https://example.com/article#comments";

function baseDeps() {
    return {
        calls: {
            workspace: 0,
            find: 0,
            quota: 0,
            scrape: 0,
            create: 0,
        },
        created: [] as Array<Record<string, unknown>>,
    };
}

describe("website source import", () => {
    it("reuses an active source for the same normalised URL without charging again", async () => {
        const state = baseDeps();
        const existing = { id: "source-existing" };
        const deps = {
            getWorkspace: async () => {
                state.calls.workspace += 1;
                return {};
            },
            findActiveSource: async (
                workspaceId: string,
                type: string,
                key: string,
                value: string,
            ) => {
                state.calls.find += 1;
                assert.equal(workspaceId, "workspace-1");
                assert.equal(type, "WEBSITE");
                assert.equal(key, "websiteIdentity");
                assert.equal(value, "https://example.com/article");
                return existing;
            },
            assertQuota: async () => {
                state.calls.quota += 1;
            },
            scrape: async () => {
                state.calls.scrape += 1;
                throw new Error("scrape must not run for duplicates");
            },
            createSource: async () => {
                state.calls.create += 1;
                return {};
            },
        } as unknown as WebsiteImportDeps;

        const result = await importWebsiteSource("workspace-1", "user-1", {
            url: VALID_URL,
        }, deps);

        assert.deepEqual(result, existing);
        assert.deepEqual(state.calls, {
            workspace: 1,
            find: 1,
            quota: 0,
            scrape: 0,
            create: 0,
        });
    });

    it("creates one bounded source with a stable identity and provider title", async () => {
        const state = baseDeps();
        const deps = {
            getWorkspace: async () => ({}),
            findActiveSource: async () => null,
            assertQuota: async () => {
                state.calls.quota += 1;
            },
            scrape: async (url: string) => {
                state.calls.scrape += 1;
                assert.equal(url, VALID_URL);
                return {
                    markdown: "Article text",
                    title: "Provider title",
                    sourceUrl: "https://www.example.com/article",
                    identity: "https://example.com/article",
                };
            },
            assertSafeUrl: async (url: string) => new URL(url),
            createSource: async (data: Record<string, unknown>) => {
                state.calls.create += 1;
                state.created.push(data);
                return { id: "source-new" };
            },
        } as unknown as WebsiteImportDeps;

        const result = await importWebsiteSource(
            "workspace-1",
            "user-1",
            { url: VALID_URL, title: "  My article  " },
            deps,
        );

        assert.deepEqual(result, { id: "source-new" });
        assert.equal(state.calls.create, 1);
        const created = state.created[0]!;
        assert.equal(created.type, "WEBSITE");
        assert.equal(created.title, "My article");
        assert.equal(created.content, "Article text");
        assert.equal(created.url, "https://www.example.com/article");
        const metadata = created.metadata as Record<string, unknown>;
        assert.equal(metadata.websiteIdentity, "https://example.com/article");
        assert.equal(metadata.importedFrom, "https://www.example.com/article");
    });

    it("rejects an invalid URL before any provider call or charge", async () => {
        const state = baseDeps();
        const deps = {
            getWorkspace: async () => ({}),
            findActiveSource: async () => null,
            assertQuota: async () => {
                state.calls.quota += 1;
            },
            scrape: async () => {
                state.calls.scrape += 1;
                return {};
            },
            createSource: async () => {
                state.calls.create += 1;
                return {};
            },
        } as unknown as WebsiteImportDeps;

        await assert.rejects(
            () =>
                importWebsiteSource(
                    "workspace-1",
                    "user-1",
                    { url: "http://127.0.0.1:8080/internal" },
                    deps,
                ),
            (error: unknown) => error instanceof ValidationError,
        );
        assert.equal(state.calls.quota, 0);
        assert.equal(state.calls.scrape, 0);
        assert.equal(state.calls.create, 0);
    });

    it("never creates or charges a source when scraping fails", async () => {
        const state = baseDeps();
        const deps = {
            getWorkspace: async () => ({}),
            findActiveSource: async () => null,
            assertQuota: async () => {
                state.calls.quota += 1;
            },
            scrape: async () => {
                throw new ValidationError("Scrape failed");
            },
            createSource: async () => {
                state.calls.create += 1;
                return {};
            },
        } as unknown as WebsiteImportDeps;

        await assert.rejects(
            () =>
                importWebsiteSource(
                    "workspace-1",
                    "user-1",
                    { url: VALID_URL },
                    deps,
                ),
            /Scrape failed/,
        );
        assert.equal(state.calls.create, 0);
    });

    it("does not create a source when extraction is empty", async () => {
        const state = baseDeps();
        const deps = {
            getWorkspace: async () => ({}),
            findActiveSource: async () => null,
            assertQuota: async () => {},
            scrape: async () => ({ markdown: "  ", sourceUrl: VALID_URL }),
            assertSafeUrl: async (url: string) => new URL(url),
            createSource: async () => {
                state.calls.create += 1;
                return {};
            },
        } as unknown as WebsiteImportDeps;

        await assert.rejects(
            () =>
                importWebsiteSource("workspace-1", "user-1", { url: VALID_URL }, deps),
            /no readable text/i,
        );
        assert.equal(state.calls.create, 0);
    });

    it("rejects an unsafe provider redirect before creating a source", async () => {
        const state = baseDeps();
        const deps = {
            getWorkspace: async () => ({}),
            findActiveSource: async () => null,
            assertQuota: async () => {},
            scrape: async () => ({
                markdown: "Article text",
                sourceUrl: "http://169.254.169.254/latest/meta-data",
            }),
            assertSafeUrl: async (url: string) => {
                if (url.includes("169.254.169.254")) {
                    throw new ValidationError("Private address rejected");
                }
                return new URL(url);
            },
            createSource: async () => {
                state.calls.create += 1;
                return {};
            },
        } as unknown as WebsiteImportDeps;

        await assert.rejects(
            () =>
                importWebsiteSource("workspace-1", "user-1", { url: VALID_URL }, deps),
            /unsafe redirect/i,
        );
        assert.equal(state.calls.create, 0);
    });

    it("reuses an active source for equivalent URLs with different hashes", async () => {
        const state = baseDeps();
        const deps = {
            getWorkspace: async () => ({}),
            findActiveSource: async (
                _workspaceId: string,
                _type: string,
                key: string,
                value: string,
            ) => {
                state.calls.find += 1;
                assert.equal(key, "websiteIdentity");
                assert.equal(value, "https://example.com/article");
                return { id: "source-existing" };
            },
            assertQuota: async () => {},
            scrape: async () => {
                throw new Error("duplicate import must not scrape");
            },
            createSource: async () => {
                state.calls.create += 1;
                return {};
            },
        } as unknown as WebsiteImportDeps;

        const result = await importWebsiteSource(
            "workspace-1",
            "user-1",
            { url: "https://example.com/article#top" },
            deps,
        );
        assert.deepEqual(result, { id: "source-existing" });
        assert.equal(state.calls.create, 0);
    });
});
