import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { ValidationError } from "../../types/app-error.js";
import {
    normalizeWebsiteUrl,
    scrapeWebsite,
    WEBSITE_MAX_MARKDOWN_CHARS,
    WEBSITE_MAX_TITLE_CHARS,
    type ScrapeWebsiteDeps,
} from "./firecrawl.js";

const ORIGINAL_KEY = process.env.FIRECRAWL_API_KEY;

function deps(scrape: ScrapeWebsiteDeps["client"]): ScrapeWebsiteDeps {
    return {
        client: scrape,
        assertSafeUrl: (async (input: string) => new URL(input)) as never,
    };
}

describe("website scraping", () => {
    beforeEach(() => {
        process.env.FIRECRAWL_API_KEY = "test-key";
    });

    afterEach(() => {
        if (ORIGINAL_KEY === undefined) delete process.env.FIRECRAWL_API_KEY;
        else process.env.FIRECRAWL_API_KEY = ORIGINAL_KEY;
    });

    it("normalises identities and drops hashes, credentials, and custom ports", () => {
        assert.equal(
            normalizeWebsiteUrl("https://Example.com/articles/one#section"),
            "https://example.com/articles/one",
        );
        assert.equal(normalizeWebsiteUrl("http://example.com:8080/page"), null);
        assert.equal(normalizeWebsiteUrl("https://user:pass@example.com/"), null);
        assert.equal(normalizeWebsiteUrl("javascript:alert(1)"), null);
        assert.equal(normalizeWebsiteUrl(null as unknown as string), null);
    });

    it("returns bounded markdown, a short title, and a validated source URL", async () => {
        const result = await scrapeWebsite(
            "https://example.com/article#comments",
            deps({
                scrape: async () => ({
                    markdown: "  Article text  ",
                    metadata: {
                        title: "A".repeat(WEBSITE_MAX_TITLE_CHARS + 50),
                        sourceURL: "https://www.example.com/article",
                    },
                }),
            }),
        );

        assert.equal(result.markdown, "Article text");
        assert.equal(result.title?.length, WEBSITE_MAX_TITLE_CHARS);
        assert.equal(result.sourceUrl, "https://www.example.com/article");
        assert.equal(result.identity, "https://example.com/article");
    });

    it("falls back to the validated input URL when provider metadata is unsafe", async () => {
        const result = await scrapeWebsite(
            "https://example.com/article",
            {
                ...deps({
                    scrape: async () => ({
                        markdown: "Safe text",
                        metadata: {
                            sourceURL: "http://169.254.169.254/latest/meta-data",
                            title: 42,
                        },
                    }),
                }),
                assertSafeUrl: (async (input: string) => {
                    const url = new URL(input);
                    if (url.hostname === "169.254.169.254") {
                        throw new ValidationError("Private address rejected");
                    }
                    return url;
                }) as never,
            },
        );

        assert.equal(result.sourceUrl, "https://example.com/article");
        assert.equal(result.title, undefined);
    });

    it("maps provider failures to safe messages without reflecting upstream text", async () => {
        const upstreamSecret = "provider-key-and-account-detail";
        await assert.rejects(
            () =>
                scrapeWebsite(
                    "https://example.com/article",
                    deps({
                        scrape: async () => {
                            throw Object.assign(new Error(upstreamSecret), {
                                status: 429,
                            });
                        },
                    }),
                ),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                assert.match(error.message, /rate limiting/i);
                assert.equal(
                    `${error.message} ${JSON.stringify(error.details)}`.includes(
                        upstreamSecret,
                    ),
                    false,
                );
                return true;
            },
        );
    });

    it("reports timeouts, blocked pages, and unsupported domains distinctly", async () => {
        const cases: Array<{
            thrown: unknown;
            pattern: RegExp;
        }> = [
            {
                thrown: Object.assign(new Error("secret-timeout-detail"), {
                    name: "TimeoutError",
                }),
                pattern: /took too long/i,
            },
            {
                thrown: Object.assign(new Error("secret-blocked-detail"), {
                    status: 403,
                    reason: "blocked",
                }),
                pattern: /blocked the scraper/i,
            },
            {
                thrown: Object.assign(new Error("secret-unsupported-detail"), {
                    status: 415,
                }),
                pattern: /not supported/i,
            },
        ];

        for (const { thrown, pattern } of cases) {
            await assert.rejects(
                () =>
                    scrapeWebsite(
                        "https://example.com/article",
                        deps({
                            scrape: async () => {
                                throw thrown;
                            },
                        }),
                    ),
                (error: unknown) => {
                    assert.ok(error instanceof ValidationError);
                    assert.match(error.message, pattern);
                    assert.equal(
                        `${error.message} ${JSON.stringify(error.details)}`.includes(
                            "secret-",
                        ),
                        false,
                    );
                    return true;
                },
            );
        }
    });

    it("rejects malformed URLs before any provider call", async () => {
        let calls = 0;
        for (const url of ["not a url", "ftp://example.com/file", "https://user:pw@example.com/"]) {
            await assert.rejects(
                () =>
                    scrapeWebsite(
                        url,
                        deps({
                            scrape: async () => {
                                calls += 1;
                                return { markdown: "text" };
                            },
                        }),
                    ),
                /valid public http\(s\) URL|valid public/i,
            );
        }
        assert.equal(calls, 0);
    });

    it("rejects empty, JavaScript-only, and oversized extracted content", async () => {
        for (const markdown of ["   ", "Please enable JavaScript to view this page"]) {
            await assert.rejects(
                () =>
                    scrapeWebsite(
                        "https://example.com/article",
                        deps({ scrape: async () => ({ markdown }) }),
                    ),
                /no readable text/i,
            );
        }

        await assert.rejects(
            () =>
                scrapeWebsite(
                    "https://example.com/article",
                    deps({
                        scrape: async () => ({
                            markdown: "x".repeat(WEBSITE_MAX_MARKDOWN_CHARS + 1),
                        }),
                    }),
                ),
            /too much text/i,
        );
    });
});
