import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { ValidationError } from "../types/app-error.js";

const ENV_KEYS = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "CLOUDINARY_UPLOAD_PRESET",
];
const ORIGINAL_ENV = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

describe("Cloudinary upload configuration", () => {
    after(() => {
        for (const [key, value] of ORIGINAL_ENV) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("fails with safe configuration details when no cloud name is set", async () => {
        for (const key of ENV_KEYS) delete process.env[key];

        const { uploadPdfToCloudinary } = await import("./cloudinary.js");

        await assert.rejects(
            () => uploadPdfToCloudinary(Buffer.from("%PDF-1.4 fake"), "notes.pdf"),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                const details = error.details as Record<string, unknown> | undefined;
                assert.equal(details?.code, "STORAGE_NOT_CONFIGURED");
                assert.equal(details?.provider, "cloudinary");
                assert.equal(details?.operation, "pdf.upload");
                assert.deepEqual(details?.missing, ["CLOUDINARY_CLOUD_NAME"]);
                assert.doesNotMatch(error.message, /secret|api[_-]?key/i);
                return true;
            },
        );
    });
});
