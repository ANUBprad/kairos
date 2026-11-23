import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { describe, it } from "node:test";
import { CSRF_FAILURE_MESSAGE, createCsrfProtection } from "./csrf.middleware.js";

const ALLOWED_ORIGIN = "https://app.example.com";
const PROTECTED_PATH = "/api/workspaces/ws_1/sources";

function fakeRequest(options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
}): Request {
    const originalUrl = options.path ?? PROTECTED_PATH;
    return {
        method: options.method ?? "POST",
        originalUrl,
        path: originalUrl,
        url: originalUrl,
        headers: options.headers ?? {},
    } as unknown as Request;
}

function fakeResponse() {
    return {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(body: unknown) {
            this.body = body;
            return this;
        },
    };
}

function run(options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
}) {
    const middleware = createCsrfProtection({ allowedOrigins: [ALLOWED_ORIGIN] });
    const res = fakeResponse();
    let nextCalls = 0;
    const next: NextFunction = (() => {
        nextCalls += 1;
    }) as NextFunction;

    middleware(fakeRequest(options), res as unknown as Response, next);
    return { res, nextCalls };
}

function assertRejected(result: ReturnType<typeof run>): void {
    assert.equal(result.nextCalls, 0);
    assert.equal(result.res.statusCode, 403);
    assert.deepEqual(result.res.body, { error: CSRF_FAILURE_MESSAGE });
}

describe("CSRF protection", () => {
    it("allows a same-origin state-changing request with an allowed Origin", () => {
        const result = run({ headers: { origin: ALLOWED_ORIGIN } });
        assert.equal(result.nextCalls, 1);
        assert.equal(result.res.statusCode, 200);
    });

    it("normalizes trailing slashes when comparing Origins", () => {
        const result = run({ headers: { origin: `${ALLOWED_ORIGIN}/` } });
        assert.equal(result.nextCalls, 1);
    });

    it("accepts same-origin and none Sec-Fetch-Site values", () => {
        for (const fetchSite of ["same-origin", "none"]) {
            const result = run({ headers: { "sec-fetch-site": fetchSite } });
            assert.equal(result.nextCalls, 1, `expected ${fetchSite} to pass`);
        }
    });

    it("rejects a disallowed Origin", () => {
        assertRejected(run({ headers: { origin: "https://evil.example" } }));
    });

    it("rejects a missing Origin instead of silently trusting the request", () => {
        assertRejected(run({ headers: {} }));
    });

    it("rejects malformed or non-http(s) Origins", () => {
        assertRejected(run({ headers: { origin: "null" } }));
        assertRejected(run({ headers: { origin: "file:///etc/passwd" } }));
        assertRejected(
            run({
                headers: {
                    origin: `${ALLOWED_ORIGIN},https://evil.example`,
                },
            }),
        );
    });

    it("rejects cross-site Sec-Fetch-Site even with an allowed Origin", () => {
        assertRejected(
            run({
                headers: {
                    origin: ALLOWED_ORIGIN,
                    "sec-fetch-site": "cross-site",
                },
            }),
        );
    });

    it("rejects same-site Sec-Fetch-Site without a valid Origin", () => {
        assertRejected(run({ headers: { "sec-fetch-site": "same-site" } }));
    });

    it("exempts auth, Razorpay webhook, and Inngest paths", () => {
        for (const path of [
            "/api/auth/sign-in/email",
            "/api/payment/webhook",
            "/api/inngest",
            "/api/inngest/functions",
        ]) {
            const result = run({ path, headers: {} });
            assert.equal(result.nextCalls, 1, `expected ${path} to be exempt`);
        }
    });

    it("does not accidentally exempt paths that merely share a prefix", () => {
        assertRejected(run({ path: "/api/authentic", headers: {} }));
    });

    it("passes non-state-changing methods and non-API routes", () => {
        for (const method of ["GET", "HEAD", "OPTIONS"]) {
            const result = run({ method, headers: {} });
            assert.equal(result.nextCalls, 1, `expected ${method} to pass`);
        }
        const outsideApi = run({ path: "/health", headers: {} });
        assert.equal(outsideApi.nextCalls, 1);
    });
});
