import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_ADD_SOURCE_DRAFT,
  addSourceDraftKey,
  clearAddSourceDraft,
  hasDraftContent,
  readAddSourceDraft,
  writeAddSourceDraft,
  type AddSourceDraft,
} from "./add-source-draft.js";

function createStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const SAMPLE: AddSourceDraft = {
  ...EMPTY_ADD_SOURCE_DRAFT,
  activeTab: "text",
  textTitle: "Notes",
  textContent: "hello world",
  githubUrl: "https://github.com/owner/repo",
  githubTitle: "Repo docs",
  selectedGithubRepoUrl: "https://github.com/owner/repo",
};

describe("add source draft key", () => {
  it("is session-scoped per workspace", () => {
    assert.equal(addSourceDraftKey("ws_123"), "kairos_add_source_draft_ws_123");
  });

  it("sanitizes unsafe or missing workspace ids", () => {
    assert.equal(addSourceDraftKey("../secret"), "kairos_add_source_draft_global");
    assert.equal(addSourceDraftKey(undefined), "kairos_add_source_draft_global");
  });
});

describe("add source draft persistence", () => {
  it("round-trips serializable form state", () => {
    const storage = createStorage();
    writeAddSourceDraft("ws_1", SAMPLE, storage);
    assert.deepEqual(readAddSourceDraft("ws_1", storage), SAMPLE);
  });

  it("never serializes credentials or file objects", () => {
    const storage = createStorage();
    writeAddSourceDraft("ws_1", SAMPLE, storage);
    const raw = storage.data.get(addSourceDraftKey("ws_1")) ?? "";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    assert.ok(
      !keys.some((key) => /token|secret|cookie|password/i.test(key)),
      `Draft contains a sensitive field: ${keys.join(", ")}`,
    );
    assert.ok(
      Object.values(parsed).every(
        (value) => value === null || typeof value !== "object",
      ),
      "Draft serialized a nested object (e.g. a File)",
    );
    assert.ok(!raw.includes("secret_"), "Draft serialized a Notion token");
  });

  it("caps oversized text content on read", () => {
    const storage = createStorage();
    storage.setItem(
      addSourceDraftKey("ws_1"),
      JSON.stringify({ version: 1, ...SAMPLE, textContent: "x".repeat(60_000) }),
    );
    assert.equal(readAddSourceDraft("ws_1", storage).textContent.length, 50_000);
  });

  it("falls back to an empty draft for malformed or outdated values", () => {
    const storage = createStorage();
    storage.setItem(addSourceDraftKey("ws_1"), "not json");
    assert.deepEqual(readAddSourceDraft("ws_1", storage), {
      ...EMPTY_ADD_SOURCE_DRAFT,
    });
    storage.setItem(
      addSourceDraftKey("ws_1"),
      JSON.stringify({ version: 99, activeTab: "github" }),
    );
    assert.deepEqual(readAddSourceDraft("ws_1", storage), {
      ...EMPTY_ADD_SOURCE_DRAFT,
    });
  });

  it("clears a saved draft", () => {
    const storage = createStorage();
    writeAddSourceDraft("ws_1", SAMPLE, storage);
    clearAddSourceDraft("ws_1", storage);
    assert.equal(storage.data.has(addSourceDraftKey("ws_1")), false);
  });

  it("returns an empty draft when storage is unavailable", () => {
    assert.deepEqual(readAddSourceDraft("ws_1", null), {
      ...EMPTY_ADD_SOURCE_DRAFT,
    });
    assert.doesNotThrow(() => writeAddSourceDraft("ws_1", SAMPLE, null));
  });
});

describe("hasDraftContent", () => {
  it("is false for an empty draft", () => {
    assert.equal(hasDraftContent({ ...EMPTY_ADD_SOURCE_DRAFT }), false);
  });

  it("is true once a tab or field is populated", () => {
    assert.equal(
      hasDraftContent({ ...EMPTY_ADD_SOURCE_DRAFT, activeTab: "github" }),
      true,
    );
    assert.equal(
      hasDraftContent({ ...EMPTY_ADD_SOURCE_DRAFT, textContent: "x" }),
      true,
    );
  });
});
