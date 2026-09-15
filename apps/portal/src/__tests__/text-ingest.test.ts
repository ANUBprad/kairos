import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TEXT_CHARS,
  normalizeTextInput,
  textDocumentFileHash,
  buildTextDocumentData,
} from "@/lib/ingestion/text";

describe("normalizeTextInput", () => {
  it("trims both the title and the content", () => {
    const normalized = normalizeTextInput("  My Note  ", "  hello world  ");
    assert.equal(normalized.title, "My Note");
    assert.equal(normalized.content, "hello world");
  });

  it("rejects empty and whitespace-only content", () => {
    assert.throws(() => normalizeTextInput("title", ""), /cannot be empty/);
    assert.throws(() => normalizeTextInput("title", "   \n\t  "), /cannot be empty/);
  });

  it("rejects oversized content", () => {
    assert.throws(
      () => normalizeTextInput("title", "x".repeat(MAX_TEXT_CHARS + 1)),
      /too large/,
    );
  });

  it("accepts content at exactly the limit", () => {
    const normalized = normalizeTextInput("title", "x".repeat(MAX_TEXT_CHARS));
    assert.equal(normalized.content.length, MAX_TEXT_CHARS);
  });

  it("rejects an over-long title", () => {
    assert.throws(() => normalizeTextInput("t".repeat(256), "body"), /too long/);
  });

  it("names the source from the first non-empty content line when no title is given", () => {
    const normalized = normalizeTextInput("", "\n\nFirst line of the note\nsecond line");
    assert.equal(normalized.name, "First line of the note");
  });

  it("truncates a long default name from the first line", () => {
    const normalized = normalizeTextInput("", "x".repeat(120));
    assert.equal(normalized.name.length, 80);
  });

  it("falls back to a placeholder name for empty title and content-only spaces", () => {
    const normalized = normalizeTextInput("", "   plain  ");
    assert.equal(normalized.name, "plain");
  });

  it("uses the trimmed title for the name", () => {
    const normalized = normalizeTextInput("  Titled note  ", "body text");
    assert.equal(normalized.name, "Titled note");
  });

  it("caps the name at the title length limit", () => {
    const normalized = normalizeTextInput("t".repeat(255), "body");
    assert.equal(normalized.name.length, 255);
  });
});

describe("textDocumentFileHash", () => {
  it("is deterministic for the same title and content", () => {
    assert.equal(
      textDocumentFileHash("A", "body"),
      textDocumentFileHash("A", "body"),
    );
  });

  it("changes when the content changes", () => {
    assert.notEqual(
      textDocumentFileHash("A", "body"),
      textDocumentFileHash("A", "body 2"),
    );
  });

  it("changes when the title changes", () => {
    assert.notEqual(
      textDocumentFileHash("A", "body"),
      textDocumentFileHash("B", "body"),
    );
  });
});

describe("buildTextDocumentData", () => {
  it("produces a first-class TEXT document with no storage or URL", () => {
    const data = buildTextDocumentData({
      kbId: "kb-1",
      userId: "user-1",
      title: "Note title",
      content: "  note body  ",
    });
    assert.equal(data.sourceType, "TEXT");
    assert.equal(data.status, "STORED");
    assert.equal(data.fileType, "txt");
    assert.equal(data.sourceUrl, null);
    assert.equal(data.storageProvider, null);
    assert.equal(data.storageKey, null);
    assert.equal(data.storageUrl, null);
    assert.equal(data.name, "Note title");
    assert.equal(data.size, Buffer.byteLength("note body", "utf8"));
    assert.equal(data.fileHash, textDocumentFileHash("Note title", "note body"));
    assert.equal(data.knowledgeBaseId, "kb-1");
    assert.equal(data.uploadedById, "user-1");
  });

  it("records only honest metadata (no fabricated author, URL, or publication date)", () => {
    const data = buildTextDocumentData({
      kbId: "kb-1",
      userId: "user-1",
      title: "Note title",
      content: "note body",
    });
    const metadata = data.metadata as Record<string, unknown>;
    assert.equal(metadata.mimeType, "text/plain");
    assert.equal(metadata.source, "text");
    assert.equal(metadata.title, "Note title");
    const keys = Object.keys(metadata).sort();
    assert.deepEqual(keys, ["mimeType", "source", "title"]);
  });

  it("leaves the title empty in metadata when none was provided", () => {
    const data = buildTextDocumentData({
      kbId: "kb-1",
      userId: "user-1",
      title: "",
      content: "note body",
    });
    const metadata = data.metadata as Record<string, unknown>;
    assert.equal(metadata.title, "");
  });
});