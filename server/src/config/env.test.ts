import assert from "node:assert/strict";
import { describe, it } from "node:test";

const ENV_KEYS = [
    "NODE_ENV",
    "DEPLOYMENT_ENV",
    "DATABASE_URL",
    "CLIENT_URL",
    "SERVER_URL",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "OAUTH_STATE_SECRET",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "CHAT_PROVIDER",
    "EMBEDDING_PROVIDER",
    "OCR_PROVIDER",
    "GEMINI_CHAT_MODEL",
    "GEMINI_SECONDARY_CHAT_MODEL",
    "GEMINI_OCR_MODEL",
    "GEMINI_EMBEDDING_MODEL",
    "OPENAI_CHAT_MODEL",
    "OPENAI_PRO_CHAT_MODEL",
    "OPENAI_OCR_MODEL",
    "OPENAI_EMBEDDING_MODEL",
    "EMBEDDING_DIMENSIONS",
    "PINECONE_API_KEY",
    "PINECONE_INDEX",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "CLOUDINARY_UPLOAD_PRESET",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "STAGING_DATABASE_ID",
    "STAGING_RESOURCE_PREFIX",
    "STAGING_FORBIDDEN_ENDPOINTS",
    "PRODUCTION_DATABASE_URL",
];

const ORIGINAL_ENV = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

function clearEnv(): void {
    for (const key of ENV_KEYS) delete process.env[key];
}

function restoreEnv(): void {
    for (const [key, value] of ORIGINAL_ENV) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
}

function validLocalEnv(): Record<string, string> {
    return {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://localhost:5432/openbook",
        BETTER_AUTH_SECRET: "x".repeat(32),
        CLIENT_URL: "http://localhost:3000",
    };
}

function validStagingEnv(): Record<string, string> {
    return {
        NODE_ENV: "production",
        DEPLOYMENT_ENV: "staging",
        DATABASE_URL: "postgresql://user:pw@staging-db.internal:5432/kairos_staging_06",
        CLIENT_URL: "https://staging.example.test",
        SERVER_URL: "https://api-staging.example.test",
        BETTER_AUTH_URL: "https://api-staging.example.test",
        BETTER_AUTH_SECRET: "staging-auth-secret-32-chars-minimum",
        OAUTH_STATE_SECRET: "staging-oauth-state-32-chars-minimum",
        GEMINI_API_KEY: "AIza-staging-only",
        PINECONE_API_KEY: "pc-staging-only",
        PINECONE_INDEX: "kairos-staging",
        CLOUDINARY_CLOUD_NAME: "kairos-staging-uploads",
        CLOUDINARY_API_KEY: "123456789012345",
        CLOUDINARY_API_SECRET: "staging-cloudinary-secret",
        CLOUDINARY_UPLOAD_PRESET: "kairos_staging_preset",
        STAGING_DATABASE_ID: "staging_06",
        STAGING_RESOURCE_PREFIX: "staging",
    };
}

function setEnv(values: Record<string, string | undefined>): void {
    clearEnv();
    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined) process.env[key] = value;
    }
}

async function envModule() {
    const mod = await import("./env.js");
    mod.resetServerEnvCacheForTests();
    return mod;
}

describe("getServerEnv", () => {
    it("rejects a downgraded or incomplete production identity", async () => {
        try {
            const productionBase = {
                ...validStagingEnv(),
                DEPLOYMENT_ENV: "production" as const,
                NODE_ENV: "production" as const,
                STAGING_DATABASE_ID: undefined,
                STAGING_RESOURCE_PREFIX: undefined,
            };
            setEnv({ ...productionBase, NODE_ENV: "development" });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /requires NODE_ENV=production/);

            setEnv({ ...productionBase, BETTER_AUTH_URL: undefined });
            const { getServerEnv: getEnv2 } = await envModule();
            assert.throws(() => getEnv2(), /BETTER_AUTH_URL/);

            setEnv({ ...productionBase, SERVER_URL: "http://api.example.net" });
            const { getServerEnv: getEnv3 } = await envModule();
            assert.throws(() => getEnv3(), /SERVER_URL must be an https URL/);

            setEnv(productionBase);
            const { getServerEnv: getEnv4 } = await envModule();
            assert.equal(getEnv4().DEPLOYMENT_ENV, "production");
        } finally {
            restoreEnv();
        }
    });

    it("accepts a minimal local configuration", async () => {
        try {
            setEnv(validLocalEnv());
            const { getServerEnv } = await envModule();
            assert.equal(getServerEnv().PORT, 8081);
        } finally {
            restoreEnv();
        }
    });

    it("rejects live Razorpay keys in a staging deployment", async () => {
        try {
            setEnv({
                ...validStagingEnv(),
                RAZORPAY_KEY_ID: "rzp_live_shouldneverappear",
            });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /Live Razorpay credentials/);
        } finally {
            restoreEnv();
        }
    });

    it("rejects non-test Razorpay keys in staging even without a live prefix", async () => {
        try {
            setEnv({ ...validStagingEnv(), RAZORPAY_KEY_ID: "rzp_other_key" });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /test-mode keys/);
        } finally {
            restoreEnv();
        }
    });

    it("requires production middleware and mandatory staging identity markers", async () => {
        try {
            setEnv({ ...validStagingEnv(), NODE_ENV: "development" });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /requires NODE_ENV=production/);

            setEnv({
                ...validStagingEnv(),
                STAGING_DATABASE_ID: undefined,
                OAUTH_STATE_SECRET: undefined,
            });
            const { getServerEnv: getEnv2 } = await envModule();
            assert.throws(() => getEnv2(), /Missing or placeholder staging configuration/);
        } finally {
            restoreEnv();
        }
    });

    it("requires a distinct OAuth state secret in staging", async () => {
        try {
            const base = validStagingEnv();
            setEnv({
                ...base,
                OAUTH_STATE_SECRET: base.BETTER_AUTH_SECRET,
            });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /must be distinct/);
        } finally {
            restoreEnv();
        }
    });

    it("rejects a production or unmarked frontend/backend origin in staging", async () => {
        try {
            const { getServerEnv } = await envModule();

            setEnv({ ...validStagingEnv(), CLIENT_URL: "https://app.example-prod.net" });
            assert.throws(() => getServerEnv(), /CLIENT_URL looks like a production endpoint/);

            setEnv({ ...validStagingEnv(), CLIENT_URL: "https://example.net" });
            assert.throws(() => getServerEnv(), /CLIENT_URL is not marked as staging-owned/);

            setEnv({ ...validStagingEnv(), CLIENT_URL: "http://staging.example.test" });
            assert.throws(() => getServerEnv(), /CLIENT_URL must use https/);

            setEnv({
                ...validStagingEnv(),
                SERVER_URL: "https://api-production.example.net",
            });
            assert.throws(() => getServerEnv(), /SERVER_URL looks like a production endpoint/);
        } finally {
            restoreEnv();
        }
    });

    it("rejects an unmarked or production-like staging database", async () => {
        try {
            const { getServerEnv } = await envModule();

            setEnv({ ...validStagingEnv(), STAGING_DATABASE_ID: "other_stage" });
            assert.throws(() => getServerEnv(), /must contain STAGING_DATABASE_ID/);

            setEnv({
                ...validStagingEnv(),
                DATABASE_URL: "postgresql://u:p@prod-db.internal:5432/kairos_staging_06",
            });
            assert.throws(() => getServerEnv(), /production endpoint/);
        } finally {
            restoreEnv();
        }
    });

    it("rejects explicitly forbidden production endpoints", async () => {
        try {
            setEnv({
                ...validStagingEnv(),
                STAGING_FORBIDDEN_ENDPOINTS: "api-staging-forbidden.example.test",
                SERVER_URL: "https://api-staging-forbidden.example.test",
            });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /forbidden production endpoint/);
        } finally {
            restoreEnv();
        }
    });

    it("rejects production-looking storage and accepts marked staging storage", async () => {
        try {
            const { getServerEnv } = await envModule();

            setEnv({
                ...validStagingEnv(),
                CLOUDINARY_CLOUD_NAME: "kairos-production-uploads",
            });
            assert.throws(() => getServerEnv(), /not marked as staging-owned/);

            setEnv(validStagingEnv());
            assert.equal(getServerEnv().CLOUDINARY_CLOUD_NAME, "kairos-staging-uploads");
        } finally {
            restoreEnv();
        }
    });

    it("does not cache a configuration that failed validation", async () => {
        try {
            setEnv({ ...validStagingEnv(), STAGING_DATABASE_ID: undefined });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /Missing or placeholder staging configuration/);

            // Correct the environment without resetting the module cache. A
            // previously failed parse must not leave a usable cached config.
            setEnv(validStagingEnv());
            assert.equal(getServerEnv().DEPLOYMENT_ENV, "staging");
        } finally {
            restoreEnv();
        }
    });

    it("defaults to Gemini and requires only credentials for active providers", async () => {
        try {
            setEnv(validStagingEnv());
            const { getServerEnv } = await envModule();
            assert.equal(getServerEnv().CHAT_PROVIDER, "gemini");
            assert.equal(getServerEnv().EMBEDDING_PROVIDER, "gemini");

            setEnv({ ...validStagingEnv(), GEMINI_API_KEY: undefined });
            const { getServerEnv: getEnv2 } = await envModule();
            assert.throws(() => getEnv2(), /GEMINI_API_KEY/);

            setEnv({
                ...validStagingEnv(),
                GEMINI_API_KEY: undefined,
                CHAT_PROVIDER: "openai",
                EMBEDDING_PROVIDER: "openai",
                OCR_PROVIDER: "openai",
                OPENAI_API_KEY: "sk-staging-only",
            });
            const { getServerEnv: getEnv3 } = await envModule();
            assert.equal(getEnv3().CHAT_PROVIDER, "openai");
        } finally {
            restoreEnv();
        }
    });

    it("rejects unsupported providers and embedding dimensions", async () => {
        try {
            setEnv({ ...validStagingEnv(), CHAT_PROVIDER: "groq" });
            const { getServerEnv } = await envModule();
            assert.throws(() => getServerEnv(), /CHAT_PROVIDER/);

            setEnv({ ...validStagingEnv(), EMBEDDING_DIMENSIONS: "4096" });
            const { getServerEnv: getEnv2 } = await envModule();
            assert.throws(() => getEnv2(), /3072 or less/);

            setEnv({
                ...validStagingEnv(),
                EMBEDDING_PROVIDER: "openai",
                OPENAI_API_KEY: "sk-staging-only",
                EMBEDDING_DIMENSIONS: "1537",
            });
            const { getServerEnv: getEnv3 } = await envModule();
            assert.throws(() => getEnv3(), /1536 or less/);
        } finally {
            restoreEnv();
        }
    });
});
