// Storage-object authorization tests at the real route boundary. Caller + DB
// tenancy resolve the document (session -> document -> KB -> signing), while
// the Cloudinary call is mocked at globalThis.fetch. The path under test is
// exactly the trust chain that was broken: an unauthenticated caller with a
// raw storageUrl must NEVER reach an object. Only a session member of the
// document's own organization should, through a signed URL derived from the
// trusted DB key — never from anything the client supplies.
//
// Requires: live test Postgres (KAIROS_TEST_DATABASE_URL / DATABASE_URL) and
// demo mode (KAIROS_DEMO_MODE=true); Cloudinary creds are injected fake values
// so getSignedUrl exercises its real signing path offline.
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { GET as documentMediaGet } from "@/app/api/documents/[docId]/media/route";

process.env.CLOUDINARY_CLOUD_NAME = "kairos-test";
process.env.CLOUDINARY_API_KEY = "kairos-test-api-key";
process.env.CLOUDINARY_API_SECRET = "kairos-test-api-secret-do-not-use";

const originalFetch = globalThis.fetch;

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

const DOC_BYTES = "some-file-bytes".repeat(137);

interface UpstreamCall {
  url: string;
  init?: RequestInit;
}

let calls: UpstreamCall[] = [];

describe("document storage media access against a real database with a mocked upstream", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const orgOwnerA = randomUUID();
  const orgOwnerB = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const projAId = randomUUID();
  const projBId = randomUUID();
  const kbAId = randomUUID();
  const kbBId = randomUUID();
  const docMainId = randomUUID();
  const docForeignId = randomUUID();
  const docNoKeyId = randomUUID();
  const docDeletedId = randomUUID();
  const docReScopedId = randomUUID();
  const unknownDocId = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();
    const demoId = await ensureDemoUser();

    await client.user.createMany({
      data: [
        { id: orgOwnerA, email: `doc-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `doc-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Doc Org A", slug: `docorga-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Doc Org B", slug: `docorgb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `docpa-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `docpb-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "Doc KB A", projectId: projAId },
        { id: kbBId, name: "Doc KB B", projectId: projBId },
      ],
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: orgOwnerA, role: "OWNER" },
        { organizationId: orgAId, userId: demoId, role: "MEMBER" },
        { organizationId: orgBId, userId: orgOwnerB, role: "OWNER" },
      ],
    });

    await client.document.createMany({
      data: [
        {
          id: docMainId,
          knowledgeBaseId: kbAId,
          name: "main.pdf",
          fileType: "pdf",
          size: DOC_BYTES.length,
          fileHash: "doc-main-hash",
          status: "STORED",
          sourceType: "FILE",
          storageProvider: "cloudinary",
          storageKey: "kbs/kb-a/main.pdf",
          storageUrl: "https://res.cloudinary.com/kairos-test/raw/upload/kbs/kb-a/main.pdf",
          uploadedById: demoId,
        },
        {
          id: docForeignId,
          knowledgeBaseId: kbBId,
          name: "foreign.pdf",
          fileType: "pdf",
          size: 100,
          fileHash: "doc-foreign-hash",
          status: "STORED",
          sourceType: "FILE",
          storageProvider: "cloudinary",
          storageKey: "kbs/kb-b/foreign.pdf",
          storageUrl: "https://res.cloudinary.com/kairos-test/raw/upload/kbs/kb-b/foreign.pdf",
          uploadedById: orgOwnerB,
        },
        {
          id: docNoKeyId,
          knowledgeBaseId: kbAId,
          name: "notes.txt",
          fileType: "txt",
          size: 5,
          fileHash: "doc-nokey-hash",
          status: "STORED",
          sourceType: "TEXT",
          storageProvider: null,
          storageKey: null,
          storageUrl: null,
          uploadedById: demoId,
        },
        {
          id: docDeletedId,
          knowledgeBaseId: kbAId,
          name: "deleted.pdf",
          fileType: "pdf",
          size: 10,
          fileHash: "doc-deleted-hash",
          status: "STORED",
          sourceType: "FILE",
          storageProvider: "cloudinary",
          storageKey: "kbs/kb-a/deleted.pdf",
          storageUrl: "https://res.cloudinary.com/kairos-test/raw/upload/kbs/kb-a/deleted.pdf",
          uploadedById: demoId,
        },
        {
          id: docReScopedId,
          knowledgeBaseId: kbAId,
          name: "rescoped.pdf",
          fileType: "pdf",
          size: 10,
          fileHash: "doc-rescoped-hash",
          status: "STORED",
          sourceType: "FILE",
          storageProvider: "cloudinary",
          storageKey: "kbs/kb-a/rescoped.pdf",
          storageUrl: "https://res.cloudinary.com/kairos-test/raw/upload/kbs/kb-a/rescoped.pdf",
          uploadedById: demoId,
        },
      ],
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
      calls.push({ url: String(input), init });
      const range = (init?.headers as Record<string, string> | undefined)?.Range;
      if (range === "bytes=0-9") {
        return new Response(DOC_BYTES.slice(0, 10), {
          status: 206,
          headers: { "content-range": `bytes 0-9/${DOC_BYTES.length}`, "content-length": "10" },
        });
      }
      return new Response(DOC_BYTES, {
        status: 200,
        headers: { "content-length": String(DOC_BYTES.length) },
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

  async function requestMedia(docId: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    return documentMediaGet(
      new NextRequest(`http://localhost:3000/api/documents/${docId}/media`, { ...init, headers }),
      { params: Promise.resolve({ docId }) },
    );
  }

  it("serves an authorized document via a signed URL derived from the trusted DB key, never its raw public URL", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await requestMedia(docMainId);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.equal((await res.text()).length, DOC_BYTES.length);

    assert.equal(calls.length, 1, "exactly one upstream fetch");
    assert.match(calls[0].url, /^https:\/\/res\.cloudinary\.com\/kairos-test\/raw\/authenticated\/kbs\/kb-a\/main\.pdf\?/);
    assert.doesNotMatch(calls[0].url, /raw\/upload\/kbs\/kb-a\/main\.pdf/, "raw public URL must never be used");
  });

  it("forwards a ranged request to storage and mirrors the 206/range math", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await requestMedia(docMainId, { headers: { range: "bytes=0-9" } });

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), `bytes 0-9/${DOC_BYTES.length}`);
    assert.equal(res.headers.get("content-length"), "10");
    assert.equal((await res.text()).length, 10);
    assert.equal((calls[0].init?.headers as Record<string, string> | undefined)?.Range, "bytes=0-9");
  });

  it("resolves a document in a knowledge base the caller cannot access to 404 without touching storage", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await requestMedia(docForeignId);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "Not found" });
    assert.equal(calls.length, 0);
  });

  it("resolves an unknown document id to 404 without touching storage", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await requestMedia(unknownDocId);
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("rejects an invalid document id shape with 400 before any lookup", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await requestMedia("!@#");
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });

  it("resolves a document without a storage key (text/url/youtube source) to 404 without touching storage", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await requestMedia(docNoKeyId);
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("resolves a deleted document row to 404 without touching storage", async (t) => {
    if (!requireEnvironment(t)) return;

    await client.document.deleteMany({ where: { id: docDeletedId } });
    const res = await requestMedia(docDeletedId);
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("resolves a document re-scoped away from the caller's knowledge base to 404", async (t) => {
    if (!requireEnvironment(t)) return;

    await client.document.update({
      where: { id: docReScopedId },
      data: { knowledgeBaseId: kbBId },
    });
    const res = await requestMedia(docReScopedId);
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("never leaks the storage key, raw URL, or signed URL into a successful response", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await requestMedia(docMainId);
    const headerBlob = [...res.headers.entries()].map(([k, v]) => `${k}:${v}`).join("\n");
    const body = await res.text();
    assert.doesNotMatch(headerBlob, /kbs\/kb-a|res\.cloudinary\.com|signature=|kairos-test-api-secret/);
    assert.doesNotMatch(body, /kbs\/kb-a|res\.cloudinary\.com|signature=|kairos-test-api-secret/);
  });
});