import { it } from "node:test";
import assert from "node:assert/strict";
import { fetchPage, type HttpGetFn } from "@/lib/ingestion/url";
import { fetchYouTubeTranscript } from "@/lib/ingestion/youtube";

for (const source of ["url", "youtube"] as const) {
  it(`${source} keeps the deadline active after response headers arrive`, async () => {
    const httpGet: HttpGetFn = async (_url, { signal }) => ({
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          const timer = setTimeout(() => controller.close(), 200);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            controller.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        },
      }),
    });
    const options = { httpGet, resolveHost: async () => ["8.8.8.8"], timeoutMs: 20 };
    await assert.rejects(
      source === "url" ? fetchPage("https://example.com", options)
        : fetchYouTubeTranscript("https://www.youtube.com/watch?v=dQw4w9WgXcQ", options),
      (error: unknown) => error instanceof Error && "code" in error
        && error.code === (source === "url" ? "timeout" : "transcript_timeout"),
    );
  });
}
