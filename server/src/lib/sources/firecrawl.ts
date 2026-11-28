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

type ProviderSignal = {
    status?: number;
    /** Only stable enum-like values are inspected; upstream message text is never read. */
    signals: string;
};

/**
 * Collects numeric status and enum-like provider fields only. Provider error
 * messages can contain credentials or account identifiers, so they are never
 * copied into the client-facing error or into logs.
 */
function readProviderSignal(error: unknown, depth = 0): ProviderSignal {
    if (!error || typeof error !== "object" || depth > 3) return { signals: "" };

    const record = error as Record<string, unknown>;
    const response = record.response;
    const responseStatus =
        response && typeof response === "object"
            ? (response as Record<string, unknown>).status
            : undefined;
    const rawStatus = record.status ?? record.statusCode ?? responseStatus;
    const status =
        typeof rawStatus === "number" && Number.isInteger(rawStatus)
            ? rawStatus
            : undefined;

    const enumValue = [record.name, record.code, record.reason, record.type]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase();
    const nested = readProviderSignal(record.cause, depth + 1);
    return {
        status: status ?? nested.status,
        signals: `${enumValue} ${nested.signals}`.trim(),
    };
}

/** Maps provider failures to status-based messages that never reflect upstream text. */
function safeScrapeError(error: unknown): ValidationError {
    const { status, signals } = readProviderSignal(error);

    const rawName = error instanceof Error ? error.name : "UnknownError";
    logger.warn("Website provider request failed", {
        operation: "scrape",
        status,
        // Only a short enum-like type name is logged, never upstream text.
        errorName: /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(rawName)
            ? rawName
            : "ProviderError",
    });

    if (
        status === 408 ||
        status === 504 ||
        /timeout|timed.?out|abort|etimedout/.test(signals)
    ) {
        return new ValidationError(
            "The page took too long to load. Try again or import a different URL.",
            { provider: "FIRECRAWL", status },
        );
    }
    if (status === 401 || /unauthorized|invalid.api.key/.test(signals)) {
        return new ValidationError(
            "The scraping provider rejected its API credentials. Check the server configuration.",
            { provider: "FIRECRAWL", status },
        );
    }
    if (
        status === 403 ||
        status === 451 ||
        /blocked|forbidden|access.denied|captcha/.test(signals)
    ) {
        return new ValidationError(
            "This site blocked the scraper. Check that the page is public, or try a different URL.",
            { provider: "FIRECRAWL", status },
        );
    }
    if (status === 429 || /rate.limit|quota/.test(signals)) {
        return new ValidationError(
            "The scraping provider is rate limiting requests. Please try again shortly.",
            { provider: "FIRECRAWL", status },
        );
    }
    if (
        status === 400 ||
        status === 404 ||
        status === 410 ||
        status === 415 ||
        status === 422 ||
        /unsupported|not.supported/.test(signals)
    ) {
        return new ValidationError(
            "This URL or domain is not supported by the scraping provider. Try another public page.",
            { provider: "FIRECRAWL", status },
        );
    }
    if (typeof status === "number" && status >= 500) {
        return new ValidationError(
            "The scraping provider is temporarily unavailable. Please try again.",
            { provider: "FIRECRAWL", status },
        );
    }
    return new ValidationError(
        "Could not reach this URL. Check that it is public and try again.",
        { provider: "FIRECRAWL" },
    );
}

function metadataString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Detects shell pages that returned HTTP 200 but contain no readable article. */
function isNonContentPage(markdown: string): boolean {
    return /(?:javascript\s+(?:is\s+)?(?:required|disabled|not\s+available)|enable\s+javascript|javascript\s+required|captcha|verify\s+you\s+are\s+(?:a\s+)?human|just\s+a\s+moment\b|access\s+denied)/i.test(
        markdown.slice(0, 2000),
    );
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
    if (!markdown || isNonContentPage(markdown)) {
        throw new ValidationError(
            "This page has no readable text. It may require JavaScript or block automated access; try a different URL.",
            { provider: "FIRECRAWL" },
        );
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
