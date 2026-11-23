import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("getServerEnv", () => {
    it("requires DATABASE_URL and BETTER_AUTH_SECRET length", async () => {
        const previous = { ...process.env };
        process.env.DATABASE_URL = "postgresql://localhost:5432/openbook";
        process.env.BETTER_AUTH_SECRET = "x".repeat(32);
        process.env.CLIENT_URL = "http://localhost:3000";
        process.env.NODE_ENV = "development";

        const { getServerEnv, resetServerEnvCacheForTests } =
            await import("./env.js");
        resetServerEnvCacheForTests();
        const env = getServerEnv();
        assert.equal(env.PORT, 8081);

        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("rejects live Razorpay keys in a staging deployment", async () => {
        const previous = { ...process.env };
        process.env.DATABASE_URL = "postgresql://localhost:5432/openbook_stage";
        process.env.BETTER_AUTH_SECRET = "x".repeat(32);
        process.env.CLIENT_URL = "https://staging.example.test";
        process.env.NODE_ENV = "production";
        process.env.DEPLOYMENT_ENV = "staging";
        process.env.RAZORPAY_KEY_ID = "rzp_live_shouldneverappear";

        const { getServerEnv, resetServerEnvCacheForTests } =
            await import("./env.js");
        resetServerEnvCacheForTests();
        assert.throws(() => getServerEnv(), /Live Razorpay credentials/);
        delete process.env.RAZORPAY_KEY_ID;
        resetServerEnvCacheForTests();

        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        resetServerEnvCacheForTests();
    });
});
