export type ParsedYouTubeUrl = {
    videoId: string;
    canonicalUrl: string;
};

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
]);

const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

const NOCOOKIE_HOSTS = new Set([
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
]);

function canonicalVideoUrl(videoId: string): ParsedYouTubeUrl {
    return {
        videoId,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
}

/**
 * Extracts a canonical 11-character YouTube video ID from a supported URL.
 *
 * Accepts standard watch URLs, youtu.be links, Shorts, live, embed and
 * youtube-nocookie embed URLs, plus a bare 11-character video ID. Hosts are
 * allow-listed and IDs must match exactly, so spoofed hosts and overlong IDs
 * cannot be truncated into a different video.
 */
export function parseYouTubeVideoUrl(input: string): ParsedYouTubeUrl | null {
    if (typeof input !== "string") return null;

    const trimmed = input.trim();
    if (VIDEO_ID_PATTERN.test(trimmed)) {
        return canonicalVideoUrl(trimmed);
    }
    if (!trimmed) return null;

    let parsed: URL;
    try {
        parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
        return null;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
    }
    if (parsed.username || parsed.password) {
        return null;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    let candidate: string | null = null;

    if (SHORT_HOSTS.has(hostname)) {
        candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (NOCOOKIE_HOSTS.has(hostname)) {
        candidate = parsed.pathname.match(/^\/embed\/([^/]+)/)?.[1] ?? null;
    } else if (YOUTUBE_HOSTS.has(hostname)) {
        if (parsed.pathname === "/watch") {
            candidate = parsed.searchParams.get("v");
        } else {
            candidate =
                parsed.pathname.match(/^\/(?:embed|v|shorts|live)\/([^/]+)/)?.[1] ?? null;
        }
    } else {
        return null;
    }

    return candidate && VIDEO_ID_PATTERN.test(candidate)
        ? canonicalVideoUrl(candidate)
        : null;
}
