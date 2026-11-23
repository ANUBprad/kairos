import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

const ENV_KEYS = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "CLOUDINARY_UPLOAD_PRESET",
];
const ORIGINAL_ENV = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

/** Cloudinary config is read at module load, so set dummy values before import. */
describe("signed Cloudinary download URLs", () => {
    after(() => {
        for (const [key, value] of ORIGINAL_ENV) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("carries a real one-hour expires_at and a signature over it", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "staging-dummy";
        process.env.CLOUDINARY_API_KEY = "123456789012345";
        process.env.CLOUDINARY_API_SECRET = "dummy-local-only-secret";

        const { getSignedCloudinaryDownloadUrl } = await import("./cloudinary.js");
        const before = Math.floor(Date.now() / 1000);
        const url = getSignedCloudinaryDownloadUrl("folder/private-source", "raw");
        const afterCall = Math.floor(Date.now() / 1000);

        assert.ok(url, "expected a signed URL when dummy credentials are set");
        const parsed = new URL(url);
        const expiresAt = Number(parsed.searchParams.get("expires_at"));
        assert.ok(
            Number.isInteger(expiresAt) &&
                expiresAt >= before + 3600 &&
                expiresAt <= afterCall + 3600,
            `expires_at must be roughly one hour ahead, got ${expiresAt}`,
        );
        assert.match(parsed.pathname, /\/raw\/download$/);
        assert.ok(parsed.searchParams.get("signature"), "URL must be signed");
        assert.ok(parsed.searchParams.get("api_key"), "URL must include the api key");
        assert.doesNotMatch(url, /s--/, "permanent s-- signatures must not be used");
    });
});
