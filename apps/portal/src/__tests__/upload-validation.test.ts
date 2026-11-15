import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_EXTENSIONS,
  assertFileContentMatchesType,
  getFileType,
  MAX_FILE_SIZE,
  partitionDuplicateUploads,
} from "@/lib/ingestion/upload-validation";

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(16)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16)]);

describe("upload file type detection", () => {
  it("uses an allowed extension regardless of a generic MIME type", () => {
    assert.equal(getFileType("paper.PDF", "application/octet-stream"), "pdf");
    assert.equal(getFileType("notes.md", ""), "md");
  });

  it("does not launder an unknown extension through a trusted MIME type", () => {
    assert.equal(getFileType("payload.exe", "application/pdf"), "exe");
    assert.equal(ALLOWED_EXTENSIONS.includes(getFileType("payload.exe", "application/pdf")), false);
  });

  it("falls back to the MIME type only when the name has no extension", () => {
    assert.equal(getFileType("paper", "application/pdf"), "pdf");
    assert.equal(getFileType("paper", "application/unknown"), "");
  });

  it("keeps the advertised limit at 10MB", () => {
    assert.equal(MAX_FILE_SIZE, 10 * 1024 * 1024);
  });
});

describe("upload content validation", () => {
  it("accepts a real PDF and DOCX signature", () => {
    assert.doesNotThrow(() => assertFileContentMatchesType("paper.pdf", PDF, "pdf"));
    assert.doesNotThrow(() => assertFileContentMatchesType("paper.docx", ZIP, "docx"));
  });

  it("rejects a text file renamed to .pdf", () => {
    assert.throws(
      () => assertFileContentMatchesType("fake.pdf", Buffer.from("just text"), "pdf"),
      /not a valid PDF/,
    );
  });

  it("rejects a non-ZIP file renamed to .docx", () => {
    assert.throws(
      () => assertFileContentMatchesType("fake.docx", Buffer.from("just text"), "docx"),
      /not a valid DOCX/,
    );
  });

  it("rejects binary content behind a text extension", () => {
    assert.throws(
      () => assertFileContentMatchesType("fake.txt", PDF, "txt"),
      /does not contain readable text/,
    );
    assert.throws(
      () => assertFileContentMatchesType("fake.csv", Buffer.from("a,b\0c"), "csv"),
      /does not contain readable text/,
    );
  });

  it("accepts plain text and UTF-8 content", () => {
    assert.doesNotThrow(() => assertFileContentMatchesType("notes.md", Buffer.from("# Café\n\nHello"), "md"));
    assert.doesNotThrow(() => assertFileContentMatchesType("data.csv", Buffer.from("a,b\n1,2\n"), "csv"));
  });
});

describe("multi-file duplicate handling", () => {
  it("skips a duplicate without rejecting the rest of the batch", () => {
    const entries = [
      { file: { name: "a.pdf" }, hash: "hash-a" },
      { file: { name: "b.pdf" }, hash: "hash-b" },
      { file: { name: "c.pdf" }, hash: "hash-c" },
    ];
    const existing = new Map([["hash-b", { name: "already-there.pdf" }]]);
    const { pending, skipped } = partitionDuplicateUploads(entries, existing);

    assert.deepEqual(pending.map((e) => e.file.name), ["a.pdf", "c.pdf"]);
    assert.equal(skipped.length, 1);
    assert.match(skipped[0].reason, /duplicate of "already-there.pdf"/);
  });

  it("skips files that duplicate each other inside one batch", () => {
    const entries = [
      { file: { name: "first.txt" }, hash: "same" },
      { file: { name: "second.txt" }, hash: "same" },
    ];
    const { pending, skipped } = partitionDuplicateUploads(entries, new Map());

    assert.deepEqual(pending.map((e) => e.file.name), ["first.txt"]);
    assert.match(skipped[0].reason, /duplicates another file in this upload/);
  });

  it("reports every file when the whole batch is duplicate", () => {
    const entries = [{ file: { name: "a.pdf" }, hash: "h" }];
    const { pending, skipped } = partitionDuplicateUploads(
      entries,
      new Map([["h", { name: "existing.pdf" }]]),
    );
    assert.equal(pending.length, 0);
    assert.equal(skipped.length, 1);
  });
});
