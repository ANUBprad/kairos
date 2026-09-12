import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Contract test for the workspace-sources schema extension.
// Reads the Prisma schema directly (the source of truth) so it runs with no DB.
// Fails if fields/enum/nullability regress: a file-less source (TEXT/URL/YOUTUBE)
// must stay representable without faking upload metadata, and existing rows must
// keep defaulting to the FILE source type.

const schema = readFileSync(path.resolve(__dirname, "../../prisma/schema.prisma"), "utf8");

function modelBlock(model: string): string {
  const match = schema.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(match, `model ${model} block not found`);
  return match![1];
}

function enumBlock(enumName: string): string {
  const match = schema.match(new RegExp(`^enum ${enumName} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(match, `enum ${enumName} block not found`);
  return match![1];
}

describe("Document source model", () => {
  it("encodes FILE, TEXT, URL, and YOUTUBE source kinds", () => {
    const enumBody = enumBlock("DocumentSourceType");
    assert.equal(enumBody.match(/\b(FILE|TEXT|URL|YOUTUBE)\b/g)?.join(" "), "FILE TEXT URL YOUTUBE");
  });

  it("adds sourceType (default FILE) and sourceUrl without breaking existing field shape", () => {
    const doc = modelBlock("Document");
    assert.match(doc, /^\s*sourceType\s+DocumentSourceType\s+@default\(FILE\)/m);
    assert.match(doc, /^\s*sourceUrl\s+String\?\s+@db\.Text/m);
    assert.match(doc, /^\s*name\s+String\s+@db\.VarChar\(255\)/m);
    assert.match(doc, /^\s*fileType\s+String\s+@db\.VarChar\(64\)/m);
    assert.match(doc, /^\s*fileHash\s+String\?\s+@db\.VarChar\(128\)/m);
    assert.match(doc, /^\s*storageUrl\s+String\?\s+@db\.Text/m);
    assert.match(doc, /@@unique\(\[knowledgeBaseId,\s*fileHash\]\)/);
  });

  it("relaxes file-only constraints so a file-less source needs no faked upload fields", () => {
    const doc = modelBlock("Document");
    assert.match(doc, /^\s*size\s+Int\?/m);
    assert.match(doc, /^\s*storageProvider\s+String\?\s+@default\("cloudinary"\)/m);
    assert.match(doc, /^\s*storageKey\s+String\?\s+@db\.VarChar\(512\)/m);
  });

  it("keeps the knowledge-base scoping intact", () => {
    const doc = modelBlock("Document");
    assert.match(doc, /^\s*knowledgeBaseId\s+String/m);
    assert.match(doc, /knowledgeBase\s+KnowledgeBase\s+@relation\(fields:\s*\[knowledgeBaseId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/m);
  });
});

describe("KnowledgeBase source-library fields", () => {
  it("adds icon and defaultModel as optional fields", () => {
    const kb = modelBlock("KnowledgeBase");
    assert.match(kb, /^\s*icon\s+String\?\s+@db\.VarChar\(32\)/m);
    assert.match(kb, /^\s*defaultModel\s+String\?/m);
  });

  it("keeps the organization -> project -> knowledge base hierarchy", () => {
    const kb = modelBlock("KnowledgeBase");
    assert.match(kb, /^\s*projectId\s+String/m);
    assert.match(kb, /project\s+Project\s+@relation\(fields:\s*\[projectId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/m);
  });
});