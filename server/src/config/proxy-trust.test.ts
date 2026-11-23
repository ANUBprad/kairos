import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { describe, it } from "node:test";

/**
 * Regression coverage for GHSA-jqcg-44mw-7w3h (proxy-addr < 2.0.8).
 *
 * A misspelled IPv4-mapped IPv6 trust subnet such as `::ffff:10.0.0.0/8`
 * compiled to a subnet that matched every IPv4 address, letting any client
 * choose `req.ip` through X-Forwarded-For. These tests exercise Express's real
 * `req.ip` getter (which calls proxy-addr) with synthetic socket addresses.
 */
function requestWithIp(
    trust: false | string | string[],
    remoteAddress: string,
    forwardedFor?: string,
): Request {
    const app = express();
    app.set("trust proxy", trust);

    const req = Object.create(express.request) as Request & {
        app: express.Express;
    };
    req.app = app;
    req.headers = forwardedFor ? { "x-forwarded-for": forwardedFor } : {};
    req.socket = { remoteAddress } as Request["socket"];
    return req;
}

describe("proxy trust and IP spoofing", () => {
    it("ignores forwarded headers when no proxy is trusted", () => {
        const req = requestWithIp(false, "192.0.2.10", "203.0.113.5");
        assert.equal(req.ip, "192.0.2.10");
        assert.deepEqual(req.ips, []);
    });

    it("accepts forwarded headers from an explicitly trusted IPv4 proxy", () => {
        const req = requestWithIp("192.0.2.10", "192.0.2.10", "203.0.113.5");
        assert.equal(req.ip, "203.0.113.5");
        assert.deepEqual(req.ips, ["203.0.113.5"]);
    });

    it("accepts forwarded headers from an explicitly trusted IPv6 proxy", () => {
        const req = requestWithIp("2001:db8::1", "2001:db8::1", "203.0.113.5");
        assert.equal(req.ip, "203.0.113.5");
    });

    it("does not treat an IPv4-mapped short-prefix subnet as matching every IPv4 client", () => {
        // Vulnerable proxy-addr versions trust 198.51.100.7 here and return the
        // attacker-controlled 203.0.113.5. Patched 2.0.8 must ignore the header.
        const req = requestWithIp(
            "::ffff:10.0.0.0/8",
            "198.51.100.7",
            "203.0.113.5",
        );
        assert.equal(req.ip, "198.51.100.7");
    });

    it("still trusts a genuine IPv4-mapped proxy address", () => {
        const req = requestWithIp(
            "::ffff:192.0.2.10",
            "::ffff:192.0.2.10",
            "203.0.113.5",
        );
        assert.equal(req.ip, "203.0.113.5");
    });

    it("keeps rate limiting keyed to the socket IP when proxies are untrusted", async () => {
        const app = express();
        app.set("trust proxy", false);
        const limiter = rateLimit({
            windowMs: 60_000,
            limit: 2,
            standardHeaders: false,
            legacyHeaders: false,
            keyGenerator: (req) =>
                ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown"),
            message: { error: "limited" },
        });
        app.get("/limited", limiter, (_req, res) => {
            res.json({ ok: true });
        });

        const server: Server = app.listen(0, "127.0.0.1");
        try {
            await new Promise<void>((resolve) => server.once("listening", resolve));
            const { port } = server.address() as AddressInfo;
            const statuses: number[] = [];
            for (const spoof of ["203.0.113.5", "198.51.100.9", "203.0.113.5"]) {
                const res = await fetch(`http://127.0.0.1:${port}/limited`, {
                    headers: { "x-forwarded-for": spoof },
                });
                statuses.push(res.status);
            }
            assert.deepEqual(statuses, [200, 200, 429]);
        } finally {
            await new Promise<void>((resolve, reject) =>
                server.close((err) => (err ? reject(err) : resolve())),
            );
        }
    });
});
