import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

// Exercises the same Better Auth HTTP surface the browser calls, through the
// real api/auth route handler, against a live Postgres. Requires DATABASE_URL
// to be set for the whole process (Prisma loads .env otherwise) — the suite
// SKIPS cleanly when it is not.
//
// The session secret is set before the auth engine is first touched so the
// lazily-created Better Auth singleton never builds without one.

process.env.BETTER_AUTH_SECRET ||= "kairos-test-secret-0123456789abcdef0123456789abcdef";

type RouteHandler = (request: import("next/server").NextRequest) => Promise<Response>;
let GET: RouteHandler | null = null;
let POST: RouteHandler | null = null;

async function ensureHandler(): Promise<boolean> {
  if (GET && POST) return true;
  const route = await import("@/app/api/auth/[...all]/route");
  GET = route.GET;
  POST = route.POST;
  return true;
}

function nextRequest(path: string, method: "GET" | "POST", body?: unknown, cookie?: string) {
  return new NextRequest(`http://localhost:3000/api/auth/${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.getSetCookie();
  const session = setCookie.find((c) => c.startsWith("kairos.session_token="));
  return session ? session.split(";")[0] : null;
}

async function errorMessage(response: Response): Promise<string | null> {
  const body = await response.json().catch(() => null);
  if (typeof body?.message === "string" && body.message.length > 0) return body.message;
  if (typeof body?.error === "string") return body.error;
  if (body?.error && typeof body.error?.message === "string") return body.error.message;
  return null;
}

describe("real authentication flow through the Better Auth endpoint", () => {
  const email = `auth-ux-${randomUUID()}@test.local`;
  const password = "Sup3r-Secret-Pass-2026";
  let client: PrismaClient | null = null;
  let primaryCookie: string | null = null;
  let userId: string | null = null;

  before(async () => {
    if (!process.env.DATABASE_URL) return;
    await ensureHandler();
    const dbUrl = process.env.KAIROS_TEST_DATABASE_URL || process.env.DATABASE_URL;
    client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await client.$connect();

    const response = await POST!(
      nextRequest("sign-up/email", "POST", { name: "Auth UX", email, password })
    );
    if (response.ok) {
      primaryCookie = sessionCookie(response);
      const body = await response.json().catch(() => null);
      userId = body?.user?.id ?? null;
    }
  });

  after(async () => {
    if (!client) return;
    try {
      if (userId) await client.session.deleteMany({ where: { userId } });
      await client.user.deleteMany({ where: { email } });
    } finally {
      await client.$disconnect();
    }
  });

  it("signing up establishes a real authenticated session", async (t) => {
    if (!POST) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    assert.ok(primaryCookie, "sign-up response must set a kairos session cookie");
    const body = await (await GET!(nextRequest("get-session", "GET", undefined, primaryCookie!))).json();
    assert.equal(body?.user?.email, email, "session must resolve to the newly created user");
    assert.notEqual(body?.user?.email, "demo@kairos.dev");
    assert.ok(userId, "sign-up should create a database user");
  });

  it("signing up again with the same email is rejected safely", async (t) => {
    if (!POST) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const response = await POST!(
      nextRequest("sign-up/email", "POST", { name: "Auth UX", email, password })
    );
    assert.ok(!response.ok, "duplicate sign-up must fail");
    assert.equal(sessionCookie(response), null, "failed sign-up must not create a session");
    assert.ok(await errorMessage(response), "failed sign-up should surface an error explanation");
  });

  it("signing in with an invalid password is rejected without a session", async (t) => {
    if (!POST) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const response = await POST!(
      nextRequest("sign-in/email", "POST", { email, password: "definitely-wrong-password" })
    );
    assert.ok(!response.ok, "invalid credentials must fail");
    assert.equal(sessionCookie(response), null, "failed login must not set a session");
    assert.ok(await errorMessage(response), "failed login should surface a safe error explanation");
  });

  it("signing in with valid credentials establishes a session", async (t) => {
    if (!POST) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const response = await POST!(
      nextRequest("sign-in/email", "POST", { email, password })
    );
    assert.ok(response.ok, "valid credentials must succeed");
    const cookie = sessionCookie(response);
    assert.ok(cookie, "successful login must set a session cookie");
    const body = await (await GET!(nextRequest("get-session", "GET", undefined, cookie))).json();
    assert.equal(body?.user?.email, email);
  });

  it("signing out invalidates the session on the server", async (t) => {
    if (!POST) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    assert.ok(primaryCookie, "needs the session from sign-up");
    const response = await POST!(nextRequest("sign-out", "POST", {}, primaryCookie!));
    assert.ok(response.ok, "sign-out must succeed");
    const body = await (await GET!(nextRequest("get-session", "GET", undefined, primaryCookie!))).json();
    assert.equal(body, null, "signed-out session token must no longer resolve");
  });

  it("a forged session cookie resolves to no session", async (t) => {
    if (!GET) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const body = await (
      await GET!(nextRequest("get-session", "GET", undefined, "kairos.session_token=forged-token-value"))
    ).json();
    assert.equal(body, null);
  });

  it("get-session is public and reports no session when unauthenticated", async (t) => {
    if (!GET) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const response = await GET!(nextRequest("get-session", "GET"));
    assert.ok(response.ok);
    const body = await response.json();
    assert.equal(body, null);
  });
});