import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    importWebsiteSchema,
    uploadPdfBodySchema,
} from "./source.validator.js";

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

describe("website import fields", () => {
    it("accepts ordinary http(s) URLs", () => {
        assert.deepEqual(importWebsiteSchema.parse({ url: "https://example.com/post" }), {
            url: "https://example.com/post",
        });
    });

    it("rejects overlong and non-http(s) URLs", () => {
        for (const url of [
            `https://example.com/${"x".repeat(2048)}`,
            "javascript:alert(1)",
            "ftp://example.com/file",
        ]) {
            assert.equal(importWebsiteSchema.safeParse({ url }).success, false);
        }
    });
});
