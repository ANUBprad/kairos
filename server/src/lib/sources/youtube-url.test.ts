import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importYoutubeSchema } from "../../validators/source.validator.js";
import {
    formatTranscriptContent,
    formatTranscriptTimestamp,
    isUnavailableYouTubeError,
    parseFirecrawlTranscript,
} from "./youtube.js";
import { parseYouTubeVideoUrl } from "./youtube-url.js";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("YouTube URL parsing", () => {
    it("accepts standard, shortened, Shorts, live, embed, and bare IDs", () => {
        const urls = [
            `https://www.youtube.com/watch?v=${VIDEO_ID}&t=42s`,
            `https://youtu.be/${VIDEO_ID}?t=1`,
            `https://www.youtube.com/shorts/${VIDEO_ID}`,
            `https://m.youtube.com/live/${VIDEO_ID}`,
            `https://www.youtube.com/embed/${VIDEO_ID}`,
            `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
            VIDEO_ID,
        ];

        for (const url of urls) {
            assert.deepEqual(parseYouTubeVideoUrl(url), {
                videoId: VIDEO_ID,
                canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
            });
        }
    });

    it("rejects spoofed hosts, malformed paths, and overlong IDs", () => {
        const invalid = [
            `https://evil-youtube.com/watch?v=${VIDEO_ID}`,
            `https://youtube.com.evil.test/watch?v=${VIDEO_ID}`,
            `https://www.youtube.com/watch?v=${VIDEO_ID}ZZ`,
            `https://youtu.be/${VIDEO_ID}ZZ`,
            `https://www.youtube.com/watch?list=PL1234`,
            `https://example.com/${VIDEO_ID}`,
            `ftp://youtube.com/watch?v=${VIDEO_ID}`,
            "not a url",
            "",
        ];

        for (const url of invalid) {
            assert.equal(parseYouTubeVideoUrl(url), null, url);
        }
    });

    it("validates the import request with the same parser", () => {
        assert.equal(
            importYoutubeSchema.safeParse({
                url: `https://www.youtube.com/shorts/${VIDEO_ID}`,
            }).success,
            true,
        );
        assert.equal(
            importYoutubeSchema.safeParse({
                url: `https://youtube.com.evil.test/watch?v=${VIDEO_ID}`,
            }).success,
            false,
        );
    });
});

describe("YouTube transcript normalization", () => {
    it("formats timestamp-prefixed caption text", () => {
        assert.equal(formatTranscriptTimestamp(0), "00:00");
        assert.equal(formatTranscriptTimestamp(65), "01:05");
        assert.equal(formatTranscriptTimestamp(3723), "1:02:03");

        assert.equal(
            formatTranscriptContent([
                {
                    text: "Welcome back",
                    offset: 65,
                    duration: 4,
                    lang: "en",
                },
            ]),
            "[01:05] Welcome back",
        );
    });

    it("accepts transcript-shaped Firecrawl output but rejects generic page markdown", () => {
        const transcript = parseFirecrawlTranscript(
            ["00:01 First line", "[00:04] Second line", "1:05 Third line"].join("\n"),
        );
        assert.deepEqual(
            transcript.map((segment) => segment.offset),
            [1, 4, 65],
        );

        assert.deepEqual(
            parseFirecrawlTranscript(
                "Subscribe to our channel. Recommended videos. Sign in to confirm you are not a bot.",
            ),
            [],
        );
    });

    it("classifies unavailable-video provider errors", () => {
        assert.equal(
            isUnavailableYouTubeError(
                Object.assign(new Error("Video unavailable"), {
                    name: "YoutubeTranscriptVideoUnavailableError",
                }),
            ),
            true,
        );
        assert.equal(
            isUnavailableYouTubeError(new Error("This video is unavailable")),
            true,
        );
        assert.equal(isUnavailableYouTubeError(new Error("network timeout")), false);
    });
});
