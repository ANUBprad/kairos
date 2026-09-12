import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildYouTubeDocumentData,
  fetchYouTubeTranscript,
  parseYouTubeUrl,
  YouTubeTranscriptError,
} from "@/lib/ingestion/youtube";
import { urlDocumentFileHash } from "@/lib/ingestion/url";
import type { HttpGetResult, ResolveHostFn } from "@/lib/ingestion/url";

// Deterministic, network-free tests. Every request path is driven through an
// injected resolver + transport so no YouTube endpoint is ever touched.

const YT_DNS: ResolveHostFn = async (host) => {
  const map: Record<string, string[]> = {
    "www.youtube.com": ["142.250.72.46"],
    "youtube.com": ["142.250.72.46"],
    "youtu.be": ["142.250.72.46"],
  };
  const addrs = map[host];
  if (!addrs) throw new Error(`no such host: ${host}`);
  return addrs;
};

function htmlResponse(body: string, status = 200, contentType = "text/plain"): HttpGetResult {
  const encoder = new TextEncoder();
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  };
}

function redirectResponse(location: string | null, status = 302): HttpGetResult {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === "location" ? location : null) },
    body: undefined,
  };
}

function infoBody(player: unknown, status = "ok"): string {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("player_response", JSON.stringify(player));
  return params.toString();
}

function ytHttpGet(bodies: { info?: string; timedText?: string } = {}): (url: string) => Promise<HttpGetResult> {
  return async (url: string): Promise<HttpGetResult> => {
    if (url.includes("get_video_info")) {
      return htmlResponse(bodies.info ?? "", 200, "application/x-www-form-urlencoded");
    }
    return htmlResponse(bodies.timedText ?? "", 200, "text/xml");
  };
}

const TIMEDTEXT = `<?xml version="1.0" encoding="utf-8"?>
<transcript>
<text start="0" dur="1.5">Hello world and welcome.</text>
<text start="1.5" dur="2">Today we learn about transcripts.</text>
<text start="3.5" dur="2.5">This is the third sentence.</text>
</transcript>`;

const EN_MANUAL = {
  baseUrl: "https://www.youtube.com/api/timedtext?lang=en&v=AbCdEfGhIjK",
  languageCode: "en",
  kind: "",
  name: { simpleText: "English" },
};

const ASR_EN = {
  baseUrl: "https://www.youtube.com/api/timedtext?lang=en&v=AbCdEfGhIjK",
  languageCode: "en",
  kind: "asr",
  name: { simpleText: "English (auto-generated)" },
};

const FR_MANUAL = {
  baseUrl: "https://www.youtube.com/api/timedtext?lang=fr&v=AbCdEfGhIjK",
  languageCode: "fr",
  kind: "",
  name: { simpleText: "Français" },
};

const INFO = infoBody({
  captions: { playerCaptionsTracklistRenderer: { captionTracks: [EN_MANUAL] } },
  videoDetails: { videoId: "AbCdEfGhIjK", title: "Kairos Demo" },
});

function isCode(code: string) {
  return (err: unknown) => err instanceof YouTubeTranscriptError && err.code === code;
}

const WATCH_URL = "https://www.youtube.com/watch?v=AbCdEfGhIjK";

describe("YouTube URL validation", () => {
  it("accepts all supported forms and canonicalizes", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=AbCdEfGhIjK",
      "https://youtu.be/AbCdEfGhIjK",
      "https://m.youtube.com/watch?v=AbCdEfGhIjK",
      "https://www.youtube.com/shorts/AbCdEfGhIjK",
      "https://www.youtube.com/embed/AbCdEfGhIjK",
      "http://www.youtube.com/watch?v=AbCdEfGhIjK",
      "https://www.youtu.be/AbCdEfGhIjK",
    ]) {
      const { videoId, canonicalUrl } = parseYouTubeUrl(url);
      assert.equal(videoId, "AbCdEfGhIjK", `${url} should yield the video id`);
      assert.equal(canonicalUrl, "https://www.youtube.com/watch?v=AbCdEfGhIjK");
    }
  });

  it("strips tracking parameters when canonicalizing", () => {
    const { canonicalUrl } = parseYouTubeUrl(
      "https://www.youtube.com/watch?v=AbCdEfGhIjK&si=abc&utm_source=x&feature=youtu.be&t=42",
    );
    assert.equal(canonicalUrl, "https://www.youtube.com/watch?v=AbCdEfGhIjK");
  });

  it("rejects non-http(s) schemes", () => {
    assert.throws(() => parseYouTubeUrl("ftp://youtube.com/watch?v=AbCdEfGhIjK"), isCode("invalid_url"));
    assert.throws(() => parseYouTubeUrl("file:///video"), isCode("invalid_url"));
  });

  it("rejects URLs with embedded credentials", () => {
    assert.throws(() => parseYouTubeUrl("https://user:pass@youtube.com/watch?v=AbCdEfGhIjK"), isCode("invalid_url"));
  });

  it("rejects lookalike and non-YouTube hosts", () => {
    for (const url of [
      "https://youtube.com.evil.com/watch?v=AbCdEfGhIjK",
      "https://youtube.com@evil.com/watch?v=AbCdEfGhIjK",
      "https://example.com/watch?v=AbCdEfGhIjK",
      "https://youtube.co.uk/watch?v=AbCdEfGhIjK",
      "https://youtube.com.attacker.com/watch?v=AbCdEfGhIjK",
    ]) {
      assert.throws(() => parseYouTubeUrl(url), isCode("unsupported_host"));
    }
  });

  it("rejects malformed URLs", () => {
    assert.throws(() => parseYouTubeUrl("not a url"), isCode("invalid_url"));
  });

  it("rejects missing or invalid video IDs", () => {
    for (const url of [
      "https://www.youtube.com/watch",
      "https://www.youtube.com/watch?v=abc",
      "https://www.youtube.com/watch?v=!!!-invalid!!!",
      "https://www.youtube.com/watch?v=AbCdEfGhIjKX",
      "https://youtu.be",
      "https://youtu.be/short",
      "https://www.youtube.com/live/AbCdEfGhIjK",
    ]) {
      assert.throws(() => parseYouTubeUrl(url), isCode("invalid_video_id"));
    }
  });
});

describe("Transcript retrieval", () => {
  it("fetches a manual English transcript with metadata", async () => {
    const { videoId, canonicalUrl, title, languageCode, autoGenerated, cueCount, text } = await fetchYouTubeTranscript(
      WATCH_URL,
      { resolveHost: YT_DNS, httpGet: ytHttpGet({ info: INFO, timedText: TIMEDTEXT }) },
    );
    assert.equal(videoId, "AbCdEfGhIjK");
    assert.equal(canonicalUrl, "https://www.youtube.com/watch?v=AbCdEfGhIjK");
    assert.equal(title, "Kairos Demo");
    assert.equal(languageCode, "en");
    assert.equal(autoGenerated, false);
    assert.equal(cueCount, 3);
    assert.equal(
      text,
      "Hello world and welcome.\n\nToday we learn about transcripts.\n\nThis is the third sentence.",
    );
  });

  it("prefers manual tracks over auto-generated ones", async () => {
    const info = infoBody({
      captions: {
        playerCaptionsTracklistRenderer: { captionTracks: [ASR_EN, FR_MANUAL] },
      },
      videoDetails: { title: "T" },
    });
    const result = await fetchYouTubeTranscript(WATCH_URL, {
      resolveHost: YT_DNS,
      httpGet: ytHttpGet({ info, timedText: TIMEDTEXT }),
    });
    assert.equal(result.languageCode, "fr");
    assert.equal(result.autoGenerated, false);
  });

  it("prefers English within the manual pool", async () => {
    const info = infoBody({
      captions: {
        playerCaptionsTracklistRenderer: { captionTracks: [FR_MANUAL, EN_MANUAL] },
      },
      videoDetails: { title: "T" },
    });
    const result = await fetchYouTubeTranscript(WATCH_URL, {
      resolveHost: YT_DNS,
      httpGet: ytHttpGet({ info, timedText: TIMEDTEXT }),
    });
    assert.equal(result.languageCode, "en");
  });

  it("falls back to an auto-generated track when no manual track exists", async () => {
    const info = infoBody({
      captions: {
        playerCaptionsTracklistRenderer: { captionTracks: [ASR_EN] },
      },
      videoDetails: { title: "T" },
    });
    const result = await fetchYouTubeTranscript(WATCH_URL, {
      resolveHost: YT_DNS,
      httpGet: ytHttpGet({ info, timedText: TIMEDTEXT }),
    });
    assert.equal(result.languageCode, "en");
    assert.equal(result.autoGenerated, true);
  });

  it("rejects videos with status=fail", async () => {
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet: ytHttpGet({ info: "status=fail&reason=Video unavailable" }) }),
      isCode("transcript_unavailable"),
    );
  });

  it("rejects videos with no caption tracks", async () => {
    const info = infoBody({
      captions: { playerCaptionsTracklistRenderer: { captionTracks: [] } },
      videoDetails: { title: "T" },
    });
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet: ytHttpGet({ info }) }),
      isCode("transcript_unavailable"),
    );
  });

  it("rejects videos with no captions block", async () => {
    const info = infoBody({ videoDetails: { title: "T" } });
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet: ytHttpGet({ info }) }),
      isCode("transcript_unavailable"),
    );
  });

  it("rejects video info without a player_response", async () => {
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet: ytHttpGet({ info: "status=ok" }) }),
      isCode("transcript_unavailable"),
    );
  });

  it("rejects a player_response that is not valid JSON", async () => {
    const info = "status=ok&player_response={" + "%20invalid";
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet: ytHttpGet({ info }) }),
      isCode("transcript_malformed"),
    );
  });

  it("follows a youtube-to-youtube redirect", async () => {
    let hits = 0;
    const httpGet = async (url: string): Promise<HttpGetResult> => {
      if (url.includes("get_video_info")) {
        hits++;
        return hits === 1
          ? redirectResponse("https://www.youtube.com/get_video_info?video_id=AbCdEfGhIjK&hl=en&el=embedded")
          : htmlResponse(INFO, 200, "application/x-www-form-urlencoded");
      }
      return htmlResponse(TIMEDTEXT, 200, "text/xml");
    };
    const result = await fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet });
    assert.equal(result.title, "Kairos Demo");
  });

  it("rejects a redirect to a non-YouTube host", async () => {
    const httpGet = async (url: string): Promise<HttpGetResult> =>
      url.includes("get_video_info") ? redirectResponse("https://evil.example/x") : htmlResponse(TIMEDTEXT, 200, "text/xml");
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet }),
      isCode("unsupported_host"),
    );
  });

  it("rejects an excessive redirect chain", async () => {
    const httpGet = async (url: string): Promise<HttpGetResult> => redirectResponse(url);
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet }),
      isCode("too_many_redirects"),
    );
  });

  it("reports a timeout when the transport hangs", async () => {
    const hanging = (_url: string, init: { signal: AbortSignal }): Promise<HttpGetResult> =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet: hanging, timeoutMs: 20 }),
      isCode("transcript_timeout"),
    );
  });

  it("reports a network failure", async () => {
    const failing = async (): Promise<HttpGetResult> => {
      throw new Error("ECONNREFUSED");
    };
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet: failing }),
      isCode("transcript_fetch"),
    );
  });

  it("rejects non-200 responses", async () => {
    const httpGet = async (): Promise<HttpGetResult> => htmlResponse("", 404);
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, { resolveHost: YT_DNS, httpGet }),
      isCode("transcript_fetch"),
    );
  });

  it("rejects timedtext over the size cap", async () => {
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, {
        resolveHost: YT_DNS,
        httpGet: ytHttpGet({ info: INFO, timedText: TIMEDTEXT }),
        maxResponseBytes: 50,
      }),
      isCode("too_large"),
    );
  });

  it("rejects timedtext that is not caption XML", async () => {
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, {
        resolveHost: YT_DNS,
        httpGet: ytHttpGet({ info: INFO, timedText: "<!DOCTYPE html><html><body>Something went wrong</body></html>" }),
      }),
      isCode("transcript_malformed"),
    );
  });

  it("rejects an empty transcript", async () => {
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, {
        resolveHost: YT_DNS,
        httpGet: ytHttpGet({ info: INFO, timedText: '<?xml version="1.0"?><transcript></transcript>' }),
      }),
      isCode("transcript_empty"),
    );
  });

  it("rejects a transcript that is too short to be useful", async () => {
    await assert.rejects(
      fetchYouTubeTranscript(WATCH_URL, {
        resolveHost: YT_DNS,
        httpGet: ytHttpGet({ info: INFO, timedText: '<transcript><text start="0" dur="1">Hi</text></transcript>' }),
      }),
      isCode("transcript_empty"),
    );
  });
});

describe("Transcript normalization", () => {
  it("decodes entities and collapses whitespace", async () => {
    const timedText =
      '<transcript><text start="0" dur="1">Don&#39;t  &quot;stop&quot; —  now &amp; forever</text></transcript>';
    const result = await fetchYouTubeTranscript(WATCH_URL, {
      resolveHost: YT_DNS,
      httpGet: ytHttpGet({ info: INFO, timedText }),
    });
    assert.equal(result.text, 'Don\'t "stop" — now & forever');
  });

  it("splits paragraphs at sentence-end cues", async () => {
    const timedText =
      '<transcript><text start="0" dur="1">First sentence.</text><text start="1" dur="1">Second one.</text>' +
      '<text start="2" dur="1">Third stays with the second.</text></transcript>';
    const result = await fetchYouTubeTranscript(WATCH_URL, {
      resolveHost: YT_DNS,
      httpGet: ytHttpGet({ info: INFO, timedText }),
    });
    assert.equal(result.text, "First sentence.\n\nSecond one.\n\nThird stays with the second.");
  });

  it("splits paragraphs at the word cap when cues do not end sentences", async () => {
    const words = Array.from({ length: 45 }, (_, i) => `word${i + 1}`);
    const timedText = `<transcript><text start="0" dur="90">${words.join(" ")}</text></transcript>`;
    const result = await fetchYouTubeTranscript(WATCH_URL, {
      resolveHost: YT_DNS,
      httpGet: ytHttpGet({ info: INFO, timedText }),
    });
    assert.equal(result.text.startsWith("word1 word2"), true);
    assert.equal(result.text.endsWith("word45"), true);
    assert.equal(result.text.includes("\n\n"), true);
  });

  it("preserves cue order and never leaks timing metadata into the text", async () => {
    const timedText =
      '<transcript><text start="12.5" dur="3.25">Alpha first.</text><text start="15.75" dur="2">Beta second.</text></transcript>';
    const result = await fetchYouTubeTranscript(WATCH_URL, {
      resolveHost: YT_DNS,
      httpGet: ytHttpGet({ info: INFO, timedText }),
    });
    assert.ok(result.text.startsWith("Alpha first."));
    assert.ok(result.text.endsWith("Beta second."));
    for (const noise of ["12.5", "15.75", "dur", "start=", "<text"]) {
      assert.equal(result.text.includes(noise), false, `text should not contain "${noise}"`);
    }
  });

  it("is deterministic across fetches", async () => {
    const opts = { resolveHost: YT_DNS, httpGet: ytHttpGet({ info: INFO, timedText: TIMEDTEXT }) };
    const a = await fetchYouTubeTranscript(WATCH_URL, opts);
    const b = await fetchYouTubeTranscript(WATCH_URL, opts);
    assert.equal(a.text, b.text);
    assert.equal(a.cueCount, b.cueCount);
  });
});

describe("YouTube document shape", () => {
  const text = "Hello world and welcome.\n\nToday we learn about transcripts.";

  it("builds a YOUTUBE-source document with null storage fields", () => {
    const data = buildYouTubeDocumentData({
      kbId: "kb_1",
      userId: "u_1",
      sourceUrl: "https://www.youtube.com/watch?v=AbCdEfGhIjK",
      videoId: "AbCdEfGhIjK",
      title: "Kairos Demo",
      languageCode: "en",
      autoGenerated: false,
      cueCount: 2,
      text,
    });
    assert.equal(data.sourceType, "YOUTUBE");
    assert.equal(data.sourceUrl, "https://www.youtube.com/watch?v=AbCdEfGhIjK");
    assert.equal(data.fileType, "txt");
    assert.equal(data.status, "STORED");
    assert.equal(data.size, Buffer.byteLength(text, "utf8"));
    assert.equal(data.storageProvider, null);
    assert.equal(data.storageKey, null);
    assert.equal(data.storageUrl, null);
    assert.equal(data.knowledgeBaseId, "kb_1");
    assert.equal(data.uploadedById, "u_1");
    assert.equal(data.name, "Kairos Demo");
    const meta = data.metadata as Record<string, unknown>;
    assert.equal(meta.mimeType, "text/plain");
    assert.equal(meta.source, "youtube");
    assert.equal(meta.videoId, "AbCdEfGhIjK");
    assert.equal(meta.languageCode, "en");
    assert.equal(meta.autoGenerated, false);
    assert.equal(meta.cueCount, 2);
  });

  it("falls back to the video id for the document name", () => {
    const data = buildYouTubeDocumentData({
      kbId: "k",
      userId: "u",
      sourceUrl: "https://www.youtube.com/watch?v=AbCdEfGhIjK",
      videoId: "AbCdEfGhIjK",
      title: "",
      languageCode: null,
      autoGenerated: true,
      cueCount: 1,
      text,
    });
    assert.equal(data.name, "YouTube AbCdEfGhIjK");
  });

  it("hashes content deterministically for duplicate detection", () => {
    const a = buildYouTubeDocumentData({
      kbId: "k1",
      userId: "u",
      sourceUrl: "u1",
      videoId: "AbCdEfGhIjK",
      title: "t",
      languageCode: "en",
      autoGenerated: false,
      cueCount: 2,
      text,
    });
    const b = buildYouTubeDocumentData({
      kbId: "k2",
      userId: "u",
      sourceUrl: "u2",
      videoId: "XXXXXXXXXXX",
      title: "t2",
      languageCode: "fr",
      autoGenerated: true,
      cueCount: 9,
      text,
    });
    assert.equal(a.fileHash, b.fileHash);
    assert.equal(a.fileHash, urlDocumentFileHash(text));
    assert.notEqual(a.fileHash, urlDocumentFileHash(text + "!"));
  });
});