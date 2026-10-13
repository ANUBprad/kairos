import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Research surface contract. There is no browser automation in the portal, so
// the grounded-research invariants — shared workspace context, real citation
// links, honest empty/error/streaming states, and a composer whose controls all
// have real actions — are pinned against the source of the canonical surface.

const chat = readFileSync(
  new URL("../components/app/chat-interface.tsx", import.meta.url),
  "utf8",
);
const chatPage = readFileSync(
  new URL("../app/app/knowledge-bases/[kbId]/chat/page.tsx", import.meta.url),
  "utf8",
);
const chatLoading = readFileSync(
  new URL("../app/app/knowledge-bases/[kbId]/chat/loading.tsx", import.meta.url),
  "utf8",
);

describe("research surface — workspace context", () => {
  it("renders the shared workspace header with research active", () => {
    assert.match(chat, /import \{ WorkspaceHeader \} from "@\/components\/app\/kb-workspace-tabs"/);
    assert.match(chat, /<WorkspaceHeader/);
    assert.match(chat, /active="research"/);
  });

  it("gates and scopes the surface to the caller's knowledge base at the page boundary", () => {
    assert.match(chatPage, /canAccessKnowledgeBase\(session\.user\.id, kbId\)/);
    assert.match(chatPage, /redirect\("\/app"\)/);
    assert.match(chatPage, /<ChatInterface kbId=\{kbId\} kbName=\{kb\.name\}/);
  });
});

describe("research surface — grounded citations", () => {
  it("links every citation to its real source chunk inside this workspace", () => {
    assert.match(chat, /\/app\/knowledge-bases\/\$\{kbId\}\/\$\{c\.documentId\}\?chunk=\$\{c\.chunkIndex\}/);
  });

  it("numbers citations and surfaces their excerpt for inspection", () => {
    assert.match(chat, /\{i \+ 1\}/);
    assert.match(chat, /line-clamp-2/);
    assert.match(chat, /c\.excerpt/);
  });

  it("renders citations from the server payload, never fabricated", () => {
    assert.match(chat, /data\.type === "citations"/);
    assert.match(chat, /setMessages\(\(prev\) =>/);
    assert.doesNotMatch(chat, /documentName: "/, "no citation may be hardcoded in the client");
  });
});

describe("research surface — streaming, empty, and error states", () => {
  it("shows a real status while an answer is being generated", () => {
    assert.match(chat, /role="status"/);
    assert.match(chat, /Searching your sources/);
    assert.match(chat, /isStreaming/);
  });

  it("reuses the streaming SSE parser without inventing a second chat API", () => {
    assert.match(chat, /data\.type === "chunk"/);
    assert.match(chat, /resolveStreamGate\(res\)/);
  });

  it("offers an honest retry instead of silently replacing a failed answer", () => {
    assert.match(chat, /retryMessage/);
    assert.match(chat, /Try again/);
    assert.match(chat, /\*\*Error:\*\*/);
  });

  it("ships a research-shaped loading skeleton, not a dashboard grid", () => {
    assert.match(chatLoading, /h-\[calc\(100dvh-16rem\)\]/);
    assert.doesNotMatch(chatLoading, /lg:grid-cols-3/);
  });
});

describe("research surface — navigation and composer", () => {
  it("keeps conversation history and new-session navigation wired to real actions", () => {
    assert.match(chat, /New research/);
    assert.match(chat, /createConversation/);
    assert.match(chat, /setActiveConversation\(conv\.id\)/);
    assert.match(chat, /aria-current=/);
  });

  it("keeps contextual Studio artifact creation from a cited turn", () => {
    assert.match(chat, /Create artifact/);
    assert.match(chat, /ARTIFACT_GENERATORS/);
  });

  it("disables the composer and send control without an active session or input", () => {
    assert.match(chat, /disabled=\{!activeConversation \|\| isStreaming\}/);
    assert.match(chat, /disabled=\{!input\.trim\(\) \|\| !activeConversation\}/);
  });

  it("sends on Enter, allows Shift+Enter newlines, and can stop generation", () => {
    assert.match(chat, /e\.key === "Enter" && !e\.shiftKey/);
    assert.match(chat, /stopGeneration/);
    assert.match(chat, /aria-label="Stop generation"/);
  });
});
