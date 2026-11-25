import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkTimestampedTranscript } from "./chunking.js";

describe("source chunking", () => {
    it("attaches transcript timestamps and deep links to chunks", () => {
        const chunks = chunkTimestampedTranscript(
            [
                { text: "Welcome back.", offset: 65, duration: 4, lang: "en" },
                { text: "Today we cover ingestion.", offset: 70, duration: 5, lang: "en" },
            ],
            {
                videoId: "dQw4w9WgXcQ",
                videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
        );

        assert.equal(chunks.length, 1);
        assert.match(chunks[0]!.content, /\[01:05\] Welcome back\./);
        assert.deepEqual(chunks[0]!.metadata, {
            contentType: "transcript",
            videoId: "dQw4w9WgXcQ",
            timestamp: "01:05",
            startSeconds: 65,
            endSeconds: 75,
            lang: "en",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=65s",
        });
    });
});
