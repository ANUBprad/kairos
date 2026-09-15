// Route-contract tests for the shared media proxy at the real route boundary:
// real Kairos authorization (session + DB tenancy) decides who reaches media,
// while the Cloudinary call itself is mocked at globalThis.fetch. The important
// path under test is "real authorization -> controlled upstream media response
// -> real proxy behavior" (206 streaming, 416 mirroring, 200 fallback, and the
// 50MB ceiling), never the real Cloudinary network.
//
// Requires: a live test Postgres (KAIROS_TEST_DATABASE_URL / DATABASE_URL) and
// demo mode (KAIROS_DEMO_MODE=true); all are set by the full validation run.
// Cloudinary credentials are injected as fake values so getSignedUrl exercises
// its real signing path offline; the mock intercepts the resulting URL.
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { PrismaClient, type Prisma } from "@prisma/client";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { GET as episodeGet } from "@/app/api/artifacts/[artifactId]/audio/route";
import { GET as interruptionGet } from "@/app/api/artifacts/[artifactId]/audio/interruption/[interruptionId]/route";

process.env.CLOUDINARY_CLOUD_NAME = "kairos-test";
process.env.CLOUDINARY_API_KEY = "kairos-test-api-key";
process.env.CLOUDINARY_API_SECRET = "kairos-test-api-secret-do-not-use";

const originalFetch = globalThis.fetch;

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

const EPISODE_MIN = "a".repeat(100);
const EPISODE_FULL = "a".repeat(5000);
const INTERRUPTION_FULL = "b".repeat(1200);

interface UpstreamCall {
  url: string;
  init?: RequestInit;
}

let calls: UpstreamCall[] = [];

describe("podcast audio media routes against a real database with a mocked upstream", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const orgOwnerA = randomUUID();
  const orgOwnerB = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const projAId = randomUUID();
  const projBId = randomUUID();
  const kbAId = randomUUID();
  const kbBId = randomUUID();
  const episodeArtifactId = randomUUID();
  const foreignArtifactId = randomUUID();
  const crossKbArtifactId = randomUUID();
  const audioLessArtifactId = randomUUID();
  const validInterruptionId = "9f1ea3a2-5555-4000-8000-000000000001";
  const unknownInterruptionId = "9f1ea3a2-5555-4000-8000-00000000dead";

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();
    const demoId = await ensureDemoUser();

    await client.user.createMany({
      data: [
        { id: orgOwnerA, email: `media-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `media-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Media Org A", slug: `mediaorga-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Media Org B", slug: `mediaorgb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `mediapa-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `mediapb-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "KB A", projectId: projAId },
        { id: kbBId, name: "KB B", projectId: projBId },
      ],
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: orgOwnerA, role: "OWNER" },
        { organizationId: orgAId, userId: demoId, role: "MEMBER" },
        { organizationId: orgBId, userId: orgOwnerB, role: "OWNER" },
      ],
    });

    const podcastContent: Prisma.InputJsonValue = {
      title: "Media Episode",
      turns: [
        { speaker: "HOST_A", text: "Let's talk about media." },
        { speaker: "HOST_B", text: "The bytes matter." },
      ],
    };

    await client.learningArtifact.create({
      data: {
        id: episodeArtifactId,
        knowledgeBaseId: kbAId,
        type: "PODCAST",
        status: "COMPLETED",
        name: "Media Episode",
        sourceIds: [],
        content: podcastContent,
        metadata: {
          audio: {
            provider: "local",
            storageProvider: "cloudinary",
            storageKey: "artifacts/podcast-media/episode.wav",
            format: "wav",
            durationSeconds: 2,
          },
          interruptions: [
            {
              id: validInterruptionId,
              question: "What does step three change?",
              turns: [
                { speaker: "HOST_A", text: "It changes the merge order." },
                { speaker: "HOST_B", text: "Exactly, the merge happens first." },
              ],
              createdAt: "2026-01-01T00:00:00.000Z",
              audio: {
                provider: "local",
                storageProvider: "cloudinary",
                storageKey: "artifacts/podcast-media/interruption.wav",
                format: "wav",
                durationSeconds: 1,
              },
            },
          ],
        },
        createdById: demoId,
      },
    });

    await client.learningArtifact.create({
      data: {
        id: crossKbArtifactId,
        knowledgeBaseId: kbBId,
        type: "PODCAST",
        status: "COMPLETED",
        name: "Foreign Episode",
        sourceIds: [],
        content: { title: "Foreign", turns: [] },
        metadata: {
          audio: {
            provider: "local",
            storageProvider: "cloudinary",
            storageKey: "artifacts/podcast-media/foreign.wav",
            format: "wav",
            durationSeconds: 3,
          },
        },
      },
    });

    await client.learningArtifact.create({
      data: {
        id: audioLessArtifactId,
        knowledgeBaseId: kbAId,
        type: "PODCAST",
        status: "COMPLETED",
        name: "Audio-less Episode",
        sourceIds: [],
        content: { title: "Silent", turns: [] },
        metadata: {},
      },
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await client.user.deleteMany({ where: { id: { in: [orgOwnerA, orgOwnerB] } } });
    } finally {
      await client.$disconnect();
    }
  });

  beforeEach(() => {
    if (!testDbUrl) return;
    calls = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      const range = (init?.headers as Record<string, string> | undefined)?.Range;
      if (range === "bytes=0-99") {
        return new Response(EPISODE_MIN, {
          status: 206,
          headers: { "content-range": "bytes 0-99/5000", "content-length": "100" },
        });
      }
      if (range === "bytes=0-1199") {
        return new Response(INTERRUPTION_FULL, {
          status: 206,
          headers: { "content-range": "bytes 0-1199/1200", "content-length": "1200" },
        });
      }
      return new Response(url.includes("interruption.wav") ? INTERRUPTION_FULL : EPISODE_FULL, {
        status: 200,
        headers: {
          "content-length": String(url.includes("interruption.wav") ? INTERRUPTION_FULL.length : EPISODE_FULL.length),
        },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function requireEnvironment(t: { skip: (message?: string) => void }): boolean {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return false;
    }
    if (!isDemoModeEnabled()) {
      t.skip("requires KAIROS_DEMO_MODE=true for the session");
      return false;
    }
    return true;
  }

  it("serves an authorized ranged episode request as a streamed 206 with the upstream's byte math", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio`, {
        headers: { range: "bytes=0-99" },
      }),
      { params: Promise.resolve({ artifactId: episodeArtifactId }) },
    );

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 0-99/5000");
    assert.equal(res.headers.get("content-length"), "100", "range length, not the total file size");
    assert.equal(res.headers.get("content-type"), "audio/wav");
    assert.equal(res.headers.get("cache-control"), "private, max-age=3600");
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.equal((await res.text()).length, 100);

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("https://res.cloudinary.com/kairos-test/raw/authenticated/artifacts/podcast-media/episode.wav?"));
    assert.equal((calls[0].init?.headers as Record<string, string> | undefined)?.Range, "bytes=0-99");
  });

  it("serves a full 200 with Accept-Ranges when the browser does not ask for a range", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio`),
      { params: Promise.resolve({ artifactId: episodeArtifactId }) },
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-length"), "5000");
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.equal((await res.text()).length, 5000);
    assert.equal((calls[0].init?.headers as Record<string, string> | undefined)?.Range, undefined);
  });

  it("resolves a foreign artifact id to 404 without touching storage", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${foreignArtifactId}/audio`),
      { params: Promise.resolve({ artifactId: foreignArtifactId }) },
    );
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("resolves an artifact in a knowledge base the session user cannot access to 404", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${crossKbArtifactId}/audio`),
      { params: Promise.resolve({ artifactId: crossKbArtifactId }) },
    );
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("resolves an episode without audio metadata to 404", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${audioLessArtifactId}/audio`),
      { params: Promise.resolve({ artifactId: audioLessArtifactId }) },
    );
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("serves a ranged interruption from the podcast's own history on the same 206 contract", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await interruptionGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio/interruption/${validInterruptionId}`, {
        headers: { range: "bytes=0-1199" },
      }),
      { params: Promise.resolve({ artifactId: episodeArtifactId, interruptionId: validInterruptionId }) },
    );

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 0-1199/1200");
    assert.equal(res.headers.get("content-length"), "1200");
    assert.equal(res.headers.get("content-type"), "audio/wav");
    assert.equal((await res.text()).length, 1200);
    assert.ok(calls[0].url.includes("artifacts/podcast-media/interruption.wav"));
    assert.equal((calls[0].init?.headers as Record<string, string> | undefined)?.Range, "bytes=0-1199");
  });

  it("resolves an interruption id outside the podcast history to 404 without touching storage", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await interruptionGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio/interruption/${unknownInterruptionId}`),
      { params: Promise.resolve({ artifactId: episodeArtifactId, interruptionId: unknownInterruptionId }) },
    );
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("mirrors a refused upstream range as 416 with the storage-provided total", async (t) => {
    if (!requireEnvironment(t)) return;

    globalThis.fetch = async (input) => {
      calls.push({ url: String(input), init: undefined });
      return new Response("bytes", { status: 416, headers: { "content-range": "bytes */5000" } });
    };
    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio`, {
        headers: { range: "bytes=999-100" },
      }),
      { params: Promise.resolve({ artifactId: episodeArtifactId }) },
    );
    assert.equal(res.status, 416);
    assert.equal(res.headers.get("content-range"), "bytes */5000");
    assert.equal(res.headers.get("content-length"), null);
  });

  it("maps an upstream failure to a sanitized 502 at both routes", async (t) => {
    if (!requireEnvironment(t)) return;

    globalThis.fetch = async (input) => {
      calls.push({ url: String(input), init: undefined });
      return new Response("denied", { status: 404 });
    };
    const episode = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio`),
      { params: Promise.resolve({ artifactId: episodeArtifactId }) },
    );
    assert.equal(episode.status, 502);
    assert.deepEqual(await episode.json(), { error: "Media upstream unavailable" });

    const interruption = await interruptionGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio/interruption/${validInterruptionId}`),
      { params: Promise.resolve({ artifactId: episodeArtifactId, interruptionId: validInterruptionId }) },
    );
    assert.equal(interruption.status, 502);
  });

  it("enforces the 50MB ceiling even on an oversized upstream response", async (t) => {
    if (!requireEnvironment(t)) return;

    globalThis.fetch = async (input) => {
      calls.push({ url: String(input), init: undefined });
      return new Response("big", { status: 200, headers: { "content-length": String(50 * 1024 * 1024 + 1) } });
    };
    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio`),
      { params: Promise.resolve({ artifactId: episodeArtifactId }) },
    );
    assert.equal(res.status, 502);
  });

  it("never leaks the storage key or the signed URL into a successful response", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await episodeGet(
      new NextRequest(`http://localhost:3000/api/artifacts/${episodeArtifactId}/audio`),
      { params: Promise.resolve({ artifactId: episodeArtifactId }) },
    );
    const headerBlob = [...res.headers.entries()].map(([k, v]) => `${k}:${v}`).join("\n");
    const body = await res.text();
    assert.doesNotMatch(headerBlob, /artifacts\/podcast-media|res\.cloudinary\.com|signature=|kairos-test-api-secret/);
    assert.doesNotMatch(body, /artifacts\/podcast-media|res\.cloudinary\.com|signature=/);
  });
});