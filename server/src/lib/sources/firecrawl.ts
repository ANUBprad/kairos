import { Firecrawl } from "firecrawl";
import { ValidationError } from "../../types/app-error.js";
import { assertSafePublicHttpUrl } from "../safe-fetch.js";
import { logger } from "../logger.js";

export const WEBSITE_MAX_URL_CHARS = 2048;
export const WEBSITE_MAX_MARKDOWN_CHARS = 500_000;
export const WEBSITE_MAX_TITLE_CHARS = 200;

export interface ScrapedWebsite {
    markdown: string;
    title?: string;
    sourceUrl: string;
    /** Stable, hash-free identity used to avoid charging duplicate imports. */
    identity: string;
}

/** Minimal client shape so provider calls can be replaced in offline tests. */
export interface WebsiteScrapeClient {
    scrape(
        url: string,
        options: { formats: readonly ["markdown"] },
    ): Promise<{
        markdown?: string | null;
        metadata?: { title?: unknown; sourceURL?: unknown } | null;
    }>;
}

export interface ScrapeWebsiteDeps {
    client?: WebsiteScrapeClient;
    assertSafeUrl?: typeof assertSafePublicHttpUrl;
}

/**
 * Produces a stable identity for a website URL. Hashes, credentials, and
 * non-default ports are discarded; provider-supplied URLs are never trusted
 * for this value.
 */
export function normalizeWebsiteUrl(input: string): string | null {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > WEBSITE_MAX_URL_CHARS) return null;

    try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        if (url.username || url.password) return null;
        if (url.port && url.port !== "80" && url.port !== "443") return null;

        url.hash = "";
        url.port = "";
        url.host = url.hostname.toLowerCase();
        return url.toString();
    } catch {
        return null;
    }
}

/** Maps provider failures to status-based messages that never reflect upstream text. */
function safeScrapeError(error: unknown): ValidationError {
    const status =
        error && typeof error === "object" && "status" in error
            ? Number((error as { status?: unknown }).status)
            : undefined;

    logger.warn("Website provider request failed", {
        operation: "scrape",
        status:
            typeof status === "number" && Number.isInteger(status)
                ? status
                : undefined,
        errorName: error instanceof Error ? error.name : "UnknownError",
    });

    if (status === 401 || status === 403) {
        return new ValidationError(
            "The scraping provider rejected this request. Check the server configuration or try again later.",
            { provider: "FIRECRAWL", status },
        );
    }
    if (status === 429) {
        return new ValidationError(
            "The scraping provider is rate limiting requests. Please try again shortly.",
            { provider: "FIRECRAWL", status },
        );
    }
    if (
        typeof status === "number" &&
        Number.isInteger(status) &&
        status >= 500
    ) {
        return new ValidationError(
            "The scraping provider is temporarily unavailable. Please try again.",
            { provider: "FIRECRAWL", status },
        );
    }
    return new ValidationError(
        "Could not extract content from this URL. Check that the page is public and try again.",
        { provider: "FIRECRAWL" },
    );
}

function metadataString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Scrapes a public website URL and returns bounded, validated content.
 * Provider metadata is sanitised: only a safe public source URL and a short
 * title are kept, and no upstream error text reaches the caller.
 */
export async function scrapeWebsite(
    url: string,
    deps: ScrapeWebsiteDeps = {},
): Promise<ScrapedWebsite> {
    const identity = normalizeWebsiteUrl(url);
    if (!identity) {
        throw new ValidationError("Enter a valid public http(s) URL");
    }

    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) {
        throw new ValidationError("Firecrawl is not configured on the server");
    }

    const assertSafeUrl = deps.assertSafeUrl ?? assertSafePublicHttpUrl;
    const safeUrl = (await assertSafeUrl(identity)).toString();
    const client =
        deps.client ?? (new Firecrawl({ apiKey }) as unknown as WebsiteScrapeClient);

    let result: Awaited<ReturnType<WebsiteScrapeClient["scrape"]>>;
    try {
        result = await client.scrape(safeUrl, { formats: ["markdown"] });
    } catch (error) {
        throw safeScrapeError(error);
    }

    const markdown =
        typeof result?.markdown === "string" ? result.markdown.trim() : "";
    if (!markdown) {
        throw new ValidationError("Could not extract content from this URL");
    }
    if (markdown.length > WEBSITE_MAX_MARKDOWN_CHARS) {
        throw new ValidationError(
            "This page contains too much text to import. Try a smaller page.",
        );
    }

    // A provider-controlled canonical URL must pass the same SSRF checks as
    // the user-supplied URL. Failures silently fall back to the validated URL.
    let sourceUrl = safeUrl;
    const providerUrl = metadataString(result?.metadata?.sourceURL);
    if (providerUrl && providerUrl.length <= WEBSITE_MAX_URL_CHARS) {
        try {
            sourceUrl = (await assertSafeUrl(providerUrl)).toString();
        } catch {
            sourceUrl = safeUrl;
        }
    }

    const title = metadataString(result?.metadata?.title)?.slice(
        0,
        WEBSITE_MAX_TITLE_CHARS,
    );

    return {
        markdown,
        ...(title ? { title } : {}),
        sourceUrl,
        identity: normalizeWebsiteUrl(safeUrl) ?? identity,
    };
}
