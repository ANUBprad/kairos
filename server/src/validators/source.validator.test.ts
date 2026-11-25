import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { uploadPdfBodySchema } from "./source.validator.js";

describe("PDF upload fields", () => {
    it("accepts an omitted or normal title", () => {
        assert.deepEqual(uploadPdfBodySchema.parse({}), {});
        assert.deepEqual(uploadPdfBodySchema.parse({ title: "  Notes  " }), {
            title: "Notes",
        });
    });

    it("rejects blank, duplicated, non-string, and overlong titles", () => {
        for (const body of [
            { title: "   " },
            { title: ["first", "second"] },
            { title: 123 },
            { title: "x".repeat(201) },
        ]) {
            assert.equal(uploadPdfBodySchema.safeParse(body).success, false);
        }
    });
});
