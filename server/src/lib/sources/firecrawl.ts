import { Firecrawl } from 'firecrawl';
import { ValidationError } from "../../types/app-error.js";
import { assertSafePublicHttpUrl } from "../safe-fetch.js";

/**
 * Scrapes a public website URL using Firecrawl and extracts clean markdown text and page title.
 *
 * @param url - Web URL to crawl and scrape
 * @returns Scraped markdown content, page title, and canonical source URL
 * @throws {ValidationError} When FIRECRAWL_API_KEY is not configured or content cannot be extracted
 */
export async function scrapeWebsite(url: string) {
    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
        throw new ValidationError("Firecrawl is not configured on the server");
    }

    const client = new Firecrawl({ apiKey });
    const safeUrl = (await assertSafePublicHttpUrl(url)).toString();
    const result = await client.scrape(safeUrl, {
        formats: ["markdown"],
    });

    const markdown = result.markdown?.trim();

    if (!markdown) {
        throw new ValidationError("Could not extract content from this URL");
    }

    return {
        markdown,
        title: result.metadata?.title,
        sourceUrl: result.metadata?.sourceURL ?? url,
    };
}