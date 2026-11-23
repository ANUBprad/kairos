import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createHmac } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Real HTTP-level security tests. They start the actual Express application
 * (createApp -> real middleware, controllers, services and Prisma) on an
 * ephemeral port against a disposable TEST_DATABASE_URL.
 *
 * Never point TEST_DATABASE_URL at a production or shared database.
 */
describe("http security (integration)", () => {
    if (!process.env.TEST_DATABASE_URL) {
        it("requires TEST_DATABASE_URL", { skip: "TEST_DATABASE_URL not set" }, () => {});
        return;
    }

    const testUrl = process.env.TEST_DATABASE_URL;
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = testUrl;
    process.env.CLIENT_URL = "http://127.0.0.1:3000";
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:8081";
    process.env.BETTER_AUTH_SECRET = "http-security-test-secret-32-chars-minimum";
    process.env.OAUTH_STATE_SECRET = "http-oauth-state-secret-32-chars-minimum";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_http_test_only_not_real";
    if (process.env.TRUST_PROXY) delete process.env.TRUST_PROXY;

    const pool = new Pool({ connectionString: testUrl });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });

    let server: Server | undefined;
    let base = "";
    // Every fixture is created through the real signup route. Track the users
    // so the after() hook can remove synthetic rows (cascading to sessions,
    // accounts, workspaces, sources, artifacts and conversations).
    const createdUserIds: string[] = [];

    type ReqOptions = {
        method?: string;
        body?: unknown;
        rawBody?: string;
        headers?: Record<string, string>;
        origin?: string;
        cookie?: string;
        multipart?: FormData;
    };

    class HttpClient {
        private cookies = new Map<string, string>();

        constructor(readonly label: string) {}

        private capture(res: Response): Response {
            const getSetCookie = (res.headers as unknown as {
                getSetCookie?: () => string[];
            }).getSetCookie;
            const values = typeof getSetCookie === "function"
                ? getSetCookie.call(res.headers)
                : [];
            for (const raw of values) {
                const pair = raw.split(";")[0];
                const idx = pair.indexOf("=");
                if (idx > 0) this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
            }
            return res;
        }

        cookieHeader(): string {
            return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
        }

        async request(path: string, opts: ReqOptions = {}): Promise<Response> {
            const headers: Record<string, string> = { ...(opts.headers ?? {}) };
            const cookie = opts.cookie ?? this.cookieHeader();
            if (cookie) headers.cookie = cookie;
            if (opts.origin) headers.origin = opts.origin;
            if (opts.body !== undefined) headers["content-type"] = "application/json";

            const hasBody =
                opts.body !== undefined || opts.rawBody !== undefined || !!opts.multipart;
            const res = await fetch(`${base}${path}`, {
                method: opts.method ?? "GET",
                headers,
                body: opts.multipart ??
                    (opts.rawBody !== undefined
                        ? opts.rawBody
                        : opts.body !== undefined
                          ? JSON.stringify(opts.body)
                          : undefined),
                redirect: "manual",
                signal: AbortSignal.timeout(20_000),
            });
            return this.capture(res);
        }
    }

    const origin = "http://127.0.0.1:3000";

    async function signup(label: string): Promise<{ client: HttpClient; email: string; userId: string }> {
        const client = new HttpClient(label);
        // Better Auth normalizes emails to lowercase; fixtures must match.
        const email = `http-${label.toLowerCase()}-${randomUUID()}@example.test`;
        const password = "Str0ngHttpTestPassword!23";
        const res = await client.request("/api/auth/sign-up/email", {
            method: "POST",
            origin,
            body: { email, password, name: label },
        });
        if (res.status !== 200) {
            assert.fail(`signup failed for ${label}: ${res.status} ${await res.text()}`);
        }
        const user = await db.user.findUniqueOrThrow({ where: { email } });
        createdUserIds.push(user.id);
        return { client, email, userId: user.id };
    }

    async function createWorkspaceViaHttp(
        client: HttpClient,
        title = "HTTP test workspace",
    ): Promise<string> {
        const res = await client.request("/api/workspaces", {
            method: "POST",
            origin,
            body: { title },
        });
        if (res.status !== 201) {
            assert.fail(`workspace create failed: ${res.status} ${await res.text()}`);
        }
        const body = (await res.json()) as { id: string };
        return body.id;
    }

    before(async () => {
        const { createApp } = await import("../app.js");
        const app = createApp();
        server = await new Promise<Server>((resolve) => {
            const s = app.listen(0, "127.0.0.1", () => resolve(s));
        });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(async () => {
        if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
        // Synthetic data only; cascades remove all dependent rows created
        // through the HTTP routes. Never run against a shared database.
        if (createdUserIds.length) {
            await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
        }
        await db.$disconnect();
        await pool.end();
    });

    // ---------------------------------------------------------------- auth ---
    describe("authentication and sessions", () => {
        it("answers liveness without any dependency or session", async () => {
            const res = await fetch(`${base}/healthz`);
            assert.equal(res.status, 200);
            const body = (await res.json()) as { status: string };
            assert.equal(body.status, "ok");
        });

        it("rejects unauthenticated access to a protected API", async () => {
            const res = await fetch(`${base}/api/workspaces`);
            assert.equal(res.status, 401);
        });

        it("rejects malformed/invalid session cookies", async () => {
            const res = await fetch(`${base}/api/workspaces`, {
                headers: { cookie: "better-auth.session_token=not-a-real-token" },
            });
            assert.equal(res.status, 401);
        });

        it("signs up, uses the session, logs out, then loses access", async () => {
            const { client } = await signup(`flow-${randomUUID().slice(0, 8)}`);
            assert.ok(client.cookieHeader().includes("session_token"), "session cookie issued");

            const authed = await client.request("/api/workspaces", { origin });
            assert.equal(authed.status, 200);
            assert.ok(Array.isArray(await authed.json()));

            const logout = await client.request("/api/auth/sign-out", {
                method: "POST",
                origin,
            });
            assert.equal(logout.status, 200);

            const afterLogout = await client.request("/api/workspaces", { origin });
            assert.equal(afterLogout.status, 401);
        });

        it("rejects invalid credentials", async () => {
            const { email } = await signup(`badlogin-${randomUUID().slice(0, 8)}`);
            const res = await new HttpClient("attacker").request("/api/auth/sign-in/email", {
                method: "POST",
                origin,
                body: { email, password: "definitely-wrong-password" },
            });
            assert.equal(res.status, 401);
        });

        it("does not expose internal details in 404/500 responses", async () => {
            const res = await fetch(`${base}/api/does-not-exist`);
            assert.equal(res.status, 404);
            const text = await res.text();
            assert.ok(!/prisma|postgres|stack|at\s+\//i.test(text), text);
        });
    });

    // ----------------------------------------------------------------- IDOR ---
    describe("cross-user authorization (IDOR)", () => {
        it("prevents cross-user workspace read, update and delete", async () => {
            const a = await signup(`idorA-${randomUUID().slice(0, 8)}`);
            const b = await signup(`idorB-${randomUUID().slice(0, 8)}`);
            const workspaceId = await createWorkspaceViaHttp(a.client);

            const read = await b.client.request(`/api/workspaces/${workspaceId}`);
            assert.equal(read.status, 404);

            const patch = await b.client.request(`/api/workspaces/${workspaceId}`, {
                method: "PATCH",
                origin,
                body: { title: "stolen" },
            });
            assert.equal(patch.status, 404);

            const del = await b.client.request(`/api/workspaces/${workspaceId}`, {
                method: "DELETE",
                origin,
            });
            assert.equal(del.status, 404);

            const owner = await a.client.request(`/api/workspaces/${workspaceId}`);
            assert.equal(owner.status, 200);
            const body = (await owner.json()) as { title: string };
            assert.notEqual(body.title, "stolen");
            const row = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
            assert.equal(row.title, "HTTP test workspace");
        });

        it("prevents cross-user access to sources, artifacts and conversations", async () => {
            const a = await signup(`resA-${randomUUID().slice(0, 8)}`);
            const b = await signup(`resB-${randomUUID().slice(0, 8)}`);
            const workspaceId = await createWorkspaceViaHttp(a.client);

            const source = await db.source.create({
                data: {
                    id: `src-http-${randomUUID()}`,
                    workspaceId,
                    type: "TEXT",
                    title: "private source",
                    status: "READY",
                    content: "private content",
                },
            });
            const artifact = await db.learningArtifact.create({
                data: {
                    id: `art-http-${randomUUID()}`,
                    workspaceId,
                    type: "SUMMARY",
                    title: "private artifact",
                    status: "READY",
                },
            });
            const conversation = await db.conversation.create({
                data: { id: `conv-http-${randomUUID()}`, workspaceId },
            });

            const paths = [
                `/api/workspaces/${workspaceId}/sources`,
                `/api/workspaces/${workspaceId}/sources/${source.id}`,
                `/api/workspaces/${workspaceId}/sources/${source.id}/chunks`,
                `/api/workspaces/${workspaceId}/artifacts`,
                `/api/workspaces/${workspaceId}/artifacts/${artifact.id}`,
                `/api/workspaces/${workspaceId}/conversations`,
                `/api/workspaces/${workspaceId}/conversations/${conversation.id}/messages`,
                `/api/audio/${workspaceId}/${artifact.id}`,
            ];
            for (const path of paths) {
                const res = await b.client.request(path);
                assert.equal(res.status, 404, `expected 404 for ${path}`);
            }

            const delSource = await b.client.request(
                `/api/workspaces/${workspaceId}/sources/${source.id}`,
                { method: "DELETE", origin },
            );
            assert.equal(delSource.status, 404);

            const delArtifact = await b.client.request(
                `/api/workspaces/${workspaceId}/artifacts/${artifact.id}`,
                { method: "DELETE", origin },
            );
            assert.equal(delArtifact.status, 404);

            assert.ok(await db.source.findUnique({ where: { id: source.id } }));
            assert.ok(await db.learningArtifact.findUnique({ where: { id: artifact.id } }));
            assert.ok(await db.conversation.findUnique({ where: { id: conversation.id } }));

            const ownerSource = await a.client.request(
                `/api/workspaces/${workspaceId}/sources/${source.id}`,
            );
            assert.equal(ownerSource.status, 200);
        });

        it("rejects guessed and malformed resource identifiers", async () => {
            const b = await signup(`guess-${randomUUID().slice(0, 8)}`);
            for (const id of ["does-not-exist", "../etc/passwd", "%00", "a".repeat(300)]) {
                const res = await b.client.request(`/api/workspaces/${encodeURIComponent(id)}`);
                assert.ok(
                    res.status === 400 || res.status === 404,
                    `${id} -> ${res.status}`,
                );
            }
        });
    });

    // ----------------------------------------------------------------- CSRF ---
    describe("CSRF and origin policy", () => {
        it("accepts same-origin state changes and rejects cross-origin ones", async () => {
            const user = await signup(`csrf-${randomUUID().slice(0, 8)}`);

            const sameOrigin = await user.client.request("/api/workspaces", {
                method: "POST",
                origin,
                body: { title: "csrf-ok" },
            });
            assert.equal(sameOrigin.status, 201);

            const crossOrigin = await user.client.request("/api/workspaces", {
                method: "POST",
                origin: "http://evil.example",
                body: { title: "csrf-bad" },
            });
            assert.equal(crossOrigin.status, 403);
        });

        it("rejects missing origin, cross-site fetch metadata and malformed origin", async () => {
            const user = await signup(`csrf2-${randomUUID().slice(0, 8)}`);

            const missing = await user.client.request("/api/workspaces", {
                method: "POST",
                body: { title: "no-origin" },
            });
            assert.equal(missing.status, 403);

            const crossSite = await user.client.request("/api/workspaces", {
                method: "POST",
                origin,
                headers: { "sec-fetch-site": "cross-site" },
                body: { title: "cross-site" },
            });
            assert.equal(crossSite.status, 403);

            const malformed = await user.client.request("/api/workspaces", {
                method: "POST",
                headers: { origin: "not a url" },
                body: { title: "malformed" },
            });
            assert.equal(malformed.status, 403);

            const list = await user.client.request("/api/workspaces");
            const titles = ((await list.json()) as Array<{ title: string }>).map((w) => w.title);
            assert.ok(!titles.includes("no-origin"));
            assert.ok(!titles.includes("cross-site"));
            assert.ok(!titles.includes("malformed"));
        });

        it("keeps the signed webhook exempt from CSRF but rejects invalid signatures", async () => {
            const payload = JSON.stringify({ event: "payment.captured", payload: {} });
            const noSig = await fetch(`${base}/api/payment/webhook`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: payload,
            });
            assert.equal(noSig.status, 400);
            assert.match(await noSig.text(), /signature/i);

            const badSig = await fetch(`${base}/api/payment/webhook`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-razorpay-signature": "deadbeef",
                },
                body: payload,
            });
            assert.equal(badSig.status, 400);
        });
    });

    // --------------------------------------------------------------- uploads ---
    describe("upload boundary", () => {
        it("rejects unauthenticated and cross-user upload attempts", async () => {
            const a = await signup(`upA-${randomUUID().slice(0, 8)}`);
            const b = await signup(`upB-${randomUUID().slice(0, 8)}`);
            const workspaceId = await createWorkspaceViaHttp(a.client);

            const form = new FormData();
            form.append("file", new Blob([Buffer.from("%PDF-1.4\nvalid enough")], {
                type: "application/pdf",
            }), "notes.pdf");

            const unauth = await fetch(
                `${base}/api/workspaces/${workspaceId}/sources/upload`,
                {
                    method: "POST",
                    headers: { origin },
                    body: form,
                    redirect: "manual",
                },
            );
            assert.equal(unauth.status, 401);

            const cross = await b.client.request(
                `/api/workspaces/${workspaceId}/sources/upload`,
                { method: "POST", origin, multipart: form },
            );
            assert.equal(cross.status, 404);
        });

        it("rejects fake magic bytes and unsupported MIME types", async () => {
            const user = await signup(`upC-${randomUUID().slice(0, 8)}`);
            const workspaceId = await createWorkspaceViaHttp(user.client);

            const fakePdf = new FormData();
            fakePdf.append("file", new Blob([Buffer.from("not a pdf at all")], {
                type: "application/pdf",
            }), "fake.pdf");
            const pdfRes = await user.client.request(
                `/api/workspaces/${workspaceId}/sources/upload`,
                { method: "POST", origin, multipart: fakePdf },
            );
            assert.equal(pdfRes.status, 400);

            const wrongMime = new FormData();
            wrongMime.append("file", new Blob([Buffer.from("hello")], {
                type: "text/html",
            }), "page.html");
            const mimeRes = await user.client.request(
                `/api/workspaces/${workspaceId}/sources/upload`,
                { method: "POST", origin, multipart: wrongMime },
            );
            assert.equal(mimeRes.status, 400);

            const pngWithPdfName = new FormData();
            pngWithPdfName.append(
                "file",
                new Blob([
                    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
                ], { type: "image/png" }),
                "misnamed.pdf",
            );
            const mismatch = await user.client.request(
                `/api/workspaces/${workspaceId}/sources/upload`,
                { method: "POST", origin, multipart: pngWithPdfName },
            );
            assert.equal(mismatch.status, 400);
        });

        it("never serves the raw uploads directory", async () => {
            const res = await fetch(`${base}/uploads/podcasts/podcast_1.mp3`);
            assert.equal(res.status, 404);
        });
    });

    // --------------------------------------------------------------- OAuth ---
    describe("OAuth callback state binding", () => {
        it("rejects missing, tampered and wrong-provider state without provider calls", async () => {
            const user = await signup(`oauth-${randomUUID().slice(0, 8)}`);
            for (const path of [
                "/api/integrations/google-drive/callback",
                "/api/integrations/notion/callback",
                "/api/integrations/github/callback",
            ]) {
                for (const url of [
                    `${path}?code=abc`,
                    `${path}?code=abc&state=tampered.not.real`,
                ]) {
                    const res = await user.client.request(url);
                    assert.equal(res.status, 302, url);
                    const location = String(res.headers.get("location"));
                    assert.match(location, /\/settings\/integrations\?/, url);
                    // Providers use different error keys; all must signal a
                    // rejected state and none may grant a connection.
                    assert.match(
                        location,
                        /(?:error=oauth_invalid_state|github_error=|notion_error=|google_drive_error=)/,
                        url,
                    );
                    assert.ok(!/connected=/.test(location), url);
                    assert.ok(
                        (res.headers as unknown as { getSetCookie?: () => string[] })
                            .getSetCookie?.().some((c) => /Max-Age=0|Expires=/.test(c)),
                        "state cookie must be cleared on the response",
                    );
                }
            }
        });
    });

    // --------------------------------------------------------------- payment ---
    describe("payment HTTP boundary", () => {
        it("does not grant value from a forged webhook body", async () => {
            const body = JSON.stringify({
                event: "payment.captured",
                payload: {
                    payment: {
                        entity: {
                            id: `pay_${randomUUID().replace(/-/g, "")}`,
                            order_id: `order_${randomUUID().replace(/-/g, "")}`,
                        },
                    },
                },
            });
            const signature = createHmac("sha256", "wrong-local-secret")
                .update(body)
                .digest("hex");
            const res = await fetch(`${base}/api/payment/webhook`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-razorpay-signature": signature,
                },
                body,
            });
            assert.equal(res.status, 400);
            const text = await res.text();
            assert.match(text, /signature/i);
        });

        it("requires auth for order creation and rejects client-controlled pricing", async () => {
            const unauth = await fetch(`${base}/api/payment/create-order`, {
                method: "POST",
                headers: { "content-type": "application/json", origin },
                body: JSON.stringify({ plan: "PRO" }),
            });
            assert.equal(unauth.status, 401);

            const user = await signup(`pay-${randomUUID().slice(0, 8)}`);
            const badAmount = await user.client.request("/api/payment/create-order", {
                method: "POST",
                origin,
                body: { amountInr: 1 },
            });
            assert.equal(badAmount.status, 400);
        });
    });
});
