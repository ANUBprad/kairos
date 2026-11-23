import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
    getAllowedOrigins,
    getBetterAuthIpHeaders,
    getBetterAuthTrustedProxies,
    getExpressTrustProxy,
    isProductionEnvironment,
} from "./network.js";

const ENV_KEYS = ["NODE_ENV", "DEPLOYMENT_ENV", "BETTER_AUTH_URL", "CLIENT_URL", "TRUST_PROXY"];
const ORIGINAL_ENV = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(values: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
}

afterEach(() => {
    for (const [key, value] of ORIGINAL_ENV) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

describe("network configuration", () => {
    it("never appends or accepts localhost origins in production", () => {
        setEnv({
            NODE_ENV: "production",
            BETTER_AUTH_URL: "https://api.example.com",
            CLIENT_URL: "https://app.example.com",
            TRUST_PROXY: undefined,
        });

        assert.deepEqual(getAllowedOrigins(), ["https://app.example.com"]);

        setEnv({ CLIENT_URL: "https://app.example.com,https://localhost:3000" });
        assert.throws(() => getAllowedOrigins(), /Localhost origins are not allowed/);
    });

    it("treats an explicit production identity as production even without NODE_ENV", () => {
        setEnv({
            NODE_ENV: "development",
            DEPLOYMENT_ENV: "production",
            BETTER_AUTH_URL: "https://api.example.com",
            CLIENT_URL: "https://app.example.com",
            TRUST_PROXY: undefined,
        });

        assert.equal(isProductionEnvironment(), true);
        assert.deepEqual(getAllowedOrigins(), ["https://app.example.com"]);
    });

    it("includes localhost origins in development", () => {
        setEnv({
            NODE_ENV: "development",
            BETTER_AUTH_URL: "http://localhost:8081",
            CLIENT_URL: "http://localhost:3000",
            TRUST_PROXY: undefined,
        });

        const origins = getAllowedOrigins();
        assert.equal(origins.includes("http://localhost:3000"), true);
        assert.equal(origins.includes("http://127.0.0.1:3000"), true);
        assert.equal(origins.includes("http://localhost:8081"), true);
    });

    it("allows numeric TRUST_PROXY hop counts in development", () => {
        setEnv({
            NODE_ENV: "development",
            BETTER_AUTH_URL: "http://localhost:8081",
            TRUST_PROXY: "2",
        });

        assert.equal(getExpressTrustProxy(), 2);
        // Better Auth cannot represent an ambiguous hop count as a trusted address.
        assert.deepEqual(getBetterAuthTrustedProxies(), []);
    });

    it("rejects numeric TRUST_PROXY in production in both proxy consumers", () => {
        setEnv({
            NODE_ENV: "production",
            BETTER_AUTH_URL: "https://api.example.com",
            CLIENT_URL: "https://app.example.com",
            TRUST_PROXY: "2",
        });

        assert.throws(() => getExpressTrustProxy(), /numeric hop counts are not allowed/);
        assert.throws(
            () => getBetterAuthTrustedProxies(),
            /numeric hop counts are not allowed/,
        );
        assert.throws(
            () => getBetterAuthIpHeaders(),
            /numeric hop counts are not allowed/,
        );
    });

    it("uses the same explicit proxy list for Express and Better Auth", () => {
        setEnv({
            NODE_ENV: "production",
            BETTER_AUTH_URL: "https://api.example.com",
            CLIENT_URL: "https://app.example.com",
            TRUST_PROXY: "10.0.0.1, 10.0.0.2",
        });

        const expected = ["10.0.0.1", "10.0.0.2"];
        assert.deepEqual(getExpressTrustProxy(), expected);
        assert.deepEqual(getBetterAuthTrustedProxies(), expected);
        assert.deepEqual(getBetterAuthIpHeaders(), [
            "x-forwarded-for",
            "x-real-ip",
            "cf-connecting-ip",
        ]);
    });

    it("accepts explicit IP/CIDR proxies and rejects malformed tokens", () => {
        setEnv({
            NODE_ENV: "production",
            BETTER_AUTH_URL: "https://api.example.com",
            CLIENT_URL: "https://app.example.com",
            TRUST_PROXY: "10.0.0.0/8, 2001:db8::1",
        });
        assert.deepEqual(getExpressTrustProxy(), ["10.0.0.0/8", "2001:db8::1"]);

        setEnv({ TRUST_PROXY: "not-an-ip" });
        assert.throws(() => getExpressTrustProxy(), /must be an IP address or CIDR/);

        setEnv({ TRUST_PROXY: "10.0.0.1/99" });
        assert.throws(() => getExpressTrustProxy(), /must be an IP address or CIDR/);
    });

    it("does not trust forwarded headers when no proxy is configured", () => {
        setEnv({
            NODE_ENV: "development",
            BETTER_AUTH_URL: "http://localhost:8081",
            TRUST_PROXY: undefined,
        });

        assert.equal(getExpressTrustProxy(), false);
        assert.deepEqual(getBetterAuthTrustedProxies(), []);
        assert.deepEqual(getBetterAuthIpHeaders(), []);
    });

    it("rejects wildcard origins", () => {
        setEnv({
            NODE_ENV: "development",
            BETTER_AUTH_URL: "http://localhost:8081",
            CLIENT_URL: "*",
        });

        assert.throws(() => getAllowedOrigins(), /Wildcard/);

        setEnv({ CLIENT_URL: "https://*.example.com" });
        assert.throws(() => getAllowedOrigins(), /Wildcard/);
    });
});
