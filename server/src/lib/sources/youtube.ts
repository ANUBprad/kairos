import {
    fetchTranscript as fetchTranscriptPlus,
    YoutubeTranscript as YoutubeTranscriptPlus,
} from "youtube-transcript-plus";
import { YoutubeTranscript } from "youtube-transcript";
import { ValidationError } from "../../types/app-error.js";
import { Firecrawl } from "firecrawl";
import { logger } from "../logger.js";
import { providerFetch } from "../provider-http.js";
import { parseYouTubeVideoUrl } from "./youtube-url.js";

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

export type TranscriptSegmentData = {
    text: string;
    offset: number;
    duration: number;
    lang: string;
};

export type YoutubeTranscriptResult = {
    videoId: string;
    canonicalUrl: string;
    content: string;
    title?: string;
    author?: string;
    lengthSeconds?: number;
    language?: string;
    captionSource: "youtube-transcript-plus" | "youtube-transcript" | "firecrawl";
    segments: TranscriptSegmentData[];
};

type TranscriptFetchResult = Omit<
    YoutubeTranscriptResult,
    "videoId" | "canonicalUrl"
>;

/** Selects a rotating desktop User-Agent for YouTube provider requests. */
function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Decodes HTML entities that appear in raw caption payloads. */
function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x2F;/g, "/")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
            String.fromCharCode(parseInt(code, 16)),
        )
        .trim();
}

/** Formats seconds as `[mm:ss]` (or `[h:mm:ss]` for long videos). */
export function formatTranscriptTimestamp(seconds: number): string {
    const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Normalizes provider segment timings; the legacy client may report milliseconds. */
function normalizeSegment(
    segment: { text?: unknown; offset?: unknown; duration?: unknown; lang?: unknown },
): TranscriptSegmentData | null {
    const text =
        typeof segment.text === "string" ? decodeHtmlEntities(segment.text) : "";
    if (!text) return null;

    let offset = Number(segment.offset ?? 0);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    if (offset > 86_400) offset /= 1000;

    let duration = Number(segment.duration ?? 0);
    if (!Number.isFinite(duration) || duration < 0) duration = 0;
    if (duration > 86_400) duration /= 1000;

    return {
        text,
        offset,
        duration,
        lang: typeof segment.lang === "string" && segment.lang ? segment.lang : "und",
    };
}

/** Builds timestamp-prefixed searchable text from normalized transcript segments. */
export function formatTranscriptContent(
    segments: TranscriptSegmentData[],
): string {
    return segments
        .map((segment) => `[${formatTranscriptTimestamp(segment.offset)}] ${segment.text}`)
        .join("\n");
}

/** Provider errors that mean the video itself cannot be ingested. */
export function isUnavailableYouTubeError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    if (
        error.name === "YoutubeTranscriptVideoUnavailableError" ||
        error.name === "YoutubeTranscriptInvalidVideoIdError"
    ) {
        return true;
    }

    return /video (is )?(unavailable|not available|doesn't exist)|private video|removed by/i.test(
        error.message,
    );
}

function logProviderFailure(provider: string, videoId: string, error: unknown): void {
    logger.warn("YouTube transcript provider attempt failed", {
        provider,
        videoId,
        reason: error instanceof Error ? error.message : String(error),
    });
}

/**
 * Uses YouTube's public oEmbed endpoint as a cheap playability check. Network
 * failures are treated as inconclusive so transcript providers can still run;
 * explicit not-found responses fail closed.
 */
async function checkYouTubeAvailability(videoId: string): Promise<{
    available: boolean;
    title?: string;
    author?: string;
}> {
    try {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await providerFetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
            { headers: { "User-Agent": getRandomUserAgent() } },
        );

        if ([401, 404, 410].includes(response.status)) {
            return { available: false };
        }
        if (!response.ok) {
            return { available: true };
        }

        const data = (await response.json()) as {
            title?: string;
            author_name?: string;
        };
        return {
            available: true,
            title: data.title?.trim(),
            author: data.author_name?.trim(),
        };
    } catch (error) {
        logProviderFailure("youtube-oembed", videoId, error);
        return { available: true };
    }
}

/** Strategy 1: youtube-transcript-plus with video details and timestamps. */
async function tryFetchTranscriptPlus(
    videoId: string,
    lang?: string,
): Promise<TranscriptFetchResult | null> {
    try {
        const result = await fetchTranscriptPlus(videoId, {
            lang,
            userAgent: getRandomUserAgent(),
            retries: 2,
            retryDelay: 1000,
            videoDetails: true,
        });

        const transcriptResult = result as {
            segments?: Array<{
                text: string;
                offset: number;
                duration: number;
                lang: string;
            }>;
            videoDetails?: {
                title?: string;
                author?: string;
                lengthSeconds?: string;
            };
        };
        const segments = (transcriptResult.segments ?? [])
            .map((segment) => normalizeSegment(segment))
            .filter((segment): segment is TranscriptSegmentData => segment !== null);

        if (segments.length === 0) return null;

        const lengthSeconds = Number(transcriptResult.videoDetails?.lengthSeconds);
        return {
            content: formatTranscriptContent(segments),
            title: transcriptResult.videoDetails?.title?.trim(),
            author: transcriptResult.videoDetails?.author?.trim(),
            ...(Number.isFinite(lengthSeconds) && lengthSeconds > 0
                ? { lengthSeconds }
                : {}),
            language: segments[0]?.lang,
            captionSource: "youtube-transcript-plus",
            segments,
        };
    } catch (error) {
        if (isUnavailableYouTubeError(error)) {
            throw new ValidationError(
                "This YouTube video is unavailable, private, or does not exist.",
            );
        }
        if (
            !(error instanceof Error) ||
            error.name !== "YoutubeTranscriptTooManyRequestError"
        ) {
            logProviderFailure("youtube-transcript-plus", videoId, error);
        }
        return null;
    }
}

/** Strategy 2: legacy youtube-transcript client. */
async function tryFetchYoutubeTranscript(
    videoId: string,
): Promise<TranscriptFetchResult | null> {
    try {
        const response = await YoutubeTranscript.fetchTranscript(videoId);
        const segments = response
            .map((segment) => normalizeSegment(segment))
            .filter((segment): segment is TranscriptSegmentData => segment !== null);

        if (segments.length === 0) return null;

        return {
            content: formatTranscriptContent(segments),
            language: segments[0]?.lang,
            captionSource: "youtube-transcript",
            segments,
        };
    } catch (error) {
        if (isUnavailableYouTubeError(error)) {
            throw new ValidationError(
                "This YouTube video is unavailable, private, or does not exist.",
            );
        }
        logProviderFailure("youtube-transcript", videoId, error);
        return null;
    }
}

/**
 * Parses Firecrawl markdown into timestamped caption-like segments. Generic
 * watch-page markdown is rejected so error/consent pages cannot become sources.
 */
export function parseFirecrawlTranscript(
    markdown: string,
): TranscriptSegmentData[] {
    const segments: TranscriptSegmentData[] = [];

    for (const rawLine of markdown.split("\n")) {
        const line = rawLine.trim();
        const match = line.match(
            /^\[?(\d{1,2}:)?([0-5]?\d):([0-5]\d)\]?\s*[-–—:]?\s*(.+)$/,
        );
        if (!match?.[4]) continue;

        const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
        const minutes = Number.parseInt(match[2], 10);
        const seconds = Number.parseInt(match[3], 10);
        const text = match[4].trim();
        if (!text) continue;

        segments.push({
            text,
            offset: hours * 3600 + minutes * 60 + seconds,
            duration: 0,
            lang: "und",
        });
    }

    return segments;
}

/** Strategy 3: Firecrawl fallback, accepted only for transcript-shaped output. */
async function tryFetchViaFirecrawl(
    videoId: string,
): Promise<TranscriptFetchResult | null> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return null;

    try {
        const client = new Firecrawl({ apiKey });
        const result = await client.scrape(
            `https://www.youtube.com/watch?v=${videoId}`,
            { formats: ["markdown"] },
        );

        const segments = parseFirecrawlTranscript(result.markdown ?? "");
        if (segments.length < 3) {
            logger.warn("Firecrawl YouTube fallback returned no usable transcript", {
                videoId,
            });
            return null;
        }

        return {
            content: formatTranscriptContent(segments),
            title: result.metadata?.title?.trim(),
            captionSource: "firecrawl",
            segments,
        };
    } catch (error) {
        logProviderFailure("firecrawl-youtube", videoId, error);
        return null;
    }
}

/**
 * Fetches closed captions and public metadata for a YouTube video URL.
 *
 * @throws {ValidationError} For invalid URLs, unavailable videos, or videos
 * with no usable transcript from any configured provider.
 */
export async function fetchYoutubeTranscript(
    url: string,
): Promise<YoutubeTranscriptResult> {
    const parsed = parseYouTubeVideoUrl(url);
    if (!parsed) {
        throw new ValidationError(
            "Enter a valid YouTube URL (watch, youtu.be, Shorts, live, or embed).",
        );
    }

    const availability = await checkYouTubeAvailability(parsed.videoId);
    if (!availability.available) {
        throw new ValidationError(
            "This YouTube video is unavailable, private, or does not exist.",
        );
    }

    let result = await tryFetchTranscriptPlus(parsed.videoId);
    if (!result) {
        result = await tryFetchTranscriptPlus(parsed.videoId, "en");
    }
    if (!result) {
        result = await tryFetchYoutubeTranscript(parsed.videoId);
    }
    if (!result) {
        result = await tryFetchViaFirecrawl(parsed.videoId);
    }

    if (!result) {
        throw new ValidationError(
            "Could not fetch a transcript for this video. Closed captions may be disabled or YouTube may be blocking this server.",
        );
    }

    return {
        videoId: parsed.videoId,
        canonicalUrl: parsed.canonicalUrl,
        title: availability.title || result.title,
        author: availability.author || result.author,
        content: result.content,
        ...(result.lengthSeconds !== undefined
            ? { lengthSeconds: result.lengthSeconds }
            : {}),
        language: result.language,
        captionSource: result.captionSource,
        segments: result.segments,
    };
}
