import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    createMarkdownSourceSchema,
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

    it("rejects overlong, credentialed, custom-port, and non-http(s) URLs", () => {
        for (const url of [
            `https://example.com/${"x".repeat(2048)}`,
            "javascript:alert(1)",
            "ftp://example.com/file",
            "https://user:pass@example.com/page",
            "http://example.com:8080/page",
        ]) {
            assert.equal(importWebsiteSchema.safeParse({ url }).success, false);
        }
    });

    it("accepts a URL at the 2048-character boundary", () => {
        const url = `https://example.com/${"x".repeat(
            2048 - "https://example.com/".length,
        )}`;
        assert.equal(importWebsiteSchema.safeParse({ url }).success, true);
    });
});

describe("markdown source fields", () => {
    it("bounds titles and markdown content", () => {
        assert.equal(
            createMarkdownSourceSchema.safeParse({
                type: "MARKDOWN",
                title: "Notes",
                content: "Body",
            }).success,
            true,
        );
        assert.equal(
            createMarkdownSourceSchema.safeParse({
                type: "MARKDOWN",
                title: "x".repeat(201),
                content: "Body",
            }).success,
            false,
        );
        assert.equal(
            createMarkdownSourceSchema.safeParse({
                type: "MARKDOWN",
                title: "Notes",
                content: "x".repeat(500_001),
            }).success,
            false,
        );
    });
});
