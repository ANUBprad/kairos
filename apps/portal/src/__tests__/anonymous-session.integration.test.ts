import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

// Anonymous access is the default entry into the workspace: a visitor with no
// account is minted a real, isolated Better Auth session by GET /api/session —
// the exact route the /app layout redirects to. This drives that route and the
// auth HTTP surface against a live Postgres, and SKIPS cleanly without one.
//
// Node's test runner runs each file in its own process, so the in-memory rate
// limiter here is independent of the other auth integration suite.

process.env.BETTER_AUTH_SECRET ||= "kairos-test-secret-0123456789abcdef0123456789abcdef";

type RouteHandler = (request: import("next/server").NextRequest) => Promise<Response>;
let authGET: RouteHandler | null = null;
let authPOST: RouteHandler | null = null;
let bootstrapGET: RouteHandler | null = null;

async function ensureHandlers(): Promise<void> {
  const authRoute = await import("@/app/api/auth/[...all]/route");
  authGET = authRoute.GET;
  authPOST = authRoute.POST;
  const sessionRoute = await import("@/app/api/session/route");
  bootstrapGET = sessionRoute.GET;
}

function authRequest(path: string, method: "GET" | "POST", body?: unknown, cookie?: string) {
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

function bootstrapRequest() {
  return new NextRequest("http://localhost:3000/api/session", {
    method: "GET",
    headers: { origin: "http://localhost:3000" },
  });
}

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.getSetCookie();
  const session = setCookie.find((c) => c.startsWith("kairos.session_token="));
  return session ? session.split(";")[0] : null;
}

describe("anonymous access bootstrap against a live database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const created: string[] = [];
  let client: PrismaClient | null = null;

  before(async () => {
    if (!process.env.DATABASE_URL) return;
    await ensureHandlers();
    const dbUrl = testDbUrl || process.env.DATABASE_URL;
    client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await client.$connect();
  });

  after(async () => {
    if (!client) return;
    try {
      if (created.length > 0) {
        // Deleting the user cascades to its sessions and any owned org.
        await client.user.deleteMany({ where: { id: { in: created } } });
      }
    } finally {
      await client.$disconnect();
    }
  });

  async function bootstrapAnonUser(): Promise<{ id: string; cookie: string }> {
    const response = await bootstrapGET!(bootstrapRequest());
    assert.ok(
      response.status >= 300 && response.status < 400,
      "bootstrap must redirect (302/307)",
    );
    assert.equal(
      new URL(response.headers.get("location")!).pathname,
      "/app",
      "bootstrap must hand the visitor back to /app",
    );
    const cookie = sessionCookie(response);
    assert.ok(cookie, "bootstrap must set a kairos session cookie");

    const body = await (
      await authGET!(authRequest("get-session", "GET", undefined, cookie!))
    ).json();
    assert.ok(body?.user?.id, "the issued session must resolve to a user");
    created.push(body.user.id);
    return { id: body.user.id, cookie: cookie! };
  }

  it("GET /api/session issues a session that resolves to an anonymous user", async (t) => {
    if (!bootstrapGET || !authGET) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const { cookie, id } = await bootstrapAnonUser();
    const body = await (
      await authGET(authRequest("get-session", "GET", undefined, cookie))
    ).json();
    assert.equal(body?.user?.id, id);
    assert.equal(body?.user?.isAnonymous, true, "the visitor must be marked anonymous");
  });

  it("two visitors receive distinct, isolated anonymous identities", async (t) => {
    if (!bootstrapGET || !authGET) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const first = await bootstrapAnonUser();
    const second = await bootstrapAnonUser();
    assert.notEqual(first.id, second.id, "visitors must not share an identity");

    // A cookie from one visitor must resolve only to its own user.
    const viaFirst = await (
      await authGET(authRequest("get-session", "GET", undefined, first.cookie))
    ).json();
    assert.equal(viaFirst?.user?.id, first.id);
    assert.notEqual(viaFirst?.user?.id, second.id);
  });

  it("anonymous deletion is disabled so account-less work survives", async (t) => {
    if (!bootstrapGET || !authPOST) { t.skip("requires DATABASE_URL (live Postgres)"); return; }
    const { cookie } = await bootstrapAnonUser();
    const response = await authPOST(
      authRequest("delete-anonymous-user", "POST", {}, cookie),
    );
    assert.ok(!response.ok, "delete-anonymous-user must be rejected when disabled");
  });
});
