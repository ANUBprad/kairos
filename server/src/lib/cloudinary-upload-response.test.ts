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
const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function detailsOf(error: unknown): Record<string, unknown> {
    assert.ok(error instanceof ValidationError);
    return (error.details ?? {}) as Record<string, unknown>;
}

describe("Cloudinary unsigned upload response validation", () => {
    after(() => {
        globalThis.fetch = ORIGINAL_FETCH;
        for (const [key, value] of ORIGINAL_ENV) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("reports the invalid field when a required URL is missing", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "local-test-cloud";
        process.env.CLOUDINARY_UPLOAD_PRESET = "local-test-preset";
        delete process.env.CLOUDINARY_API_KEY;
        delete process.env.CLOUDINARY_API_SECRET;

        const { uploadPdfToCloudinary } = await import("./cloudinary.js");
        globalThis.fetch = (async () =>
            jsonResponse({ public_id: "kairos/pdfs/test", bytes: 12 })) as typeof fetch;

        await assert.rejects(
            () => uploadPdfToCloudinary(Buffer.from("%PDF-1.4 fake"), "notes.pdf"),
            (error: unknown) => {
                const details = detailsOf(error);
                assert.equal(details.code, "STORAGE_RESPONSE_INVALID");
                assert.equal(details.field, "secure_url");
                return true;
            },
        );
    });

    it("accepts a valid response without the optional bytes field", async () => {
        const { uploadPdfToCloudinary } = await import("./cloudinary.js");
        globalThis.fetch = (async () =>
            jsonResponse({
                secure_url: "https://res.cloudinary.com/local-test-cloud/raw/upload/note.pdf",
                public_id: "kairos/pdfs/test",
            })) as typeof fetch;

        const buffer = Buffer.from("%PDF-1.4 fake");
        const result = await uploadPdfToCloudinary(buffer, "notes.pdf");

        assert.equal(result.secureUrl.startsWith("https://"), true);
        assert.equal(result.publicId, "kairos/pdfs/test");
        assert.equal(result.bytes, buffer.byteLength);
        assert.equal(result.originalFilename, "notes.pdf");
        assert.equal(result.resourceType, "raw");
    });
});
