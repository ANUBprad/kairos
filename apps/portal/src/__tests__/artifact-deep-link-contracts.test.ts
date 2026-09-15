import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isValidEntityId } from "@/lib/validation";

// Deep-link navigation contract. The portal has no browser automation
// infrastructure, so the navigation wiring (chat → artifact detail → back to
// research) is pinned against the source of every file that participates in a
// move, keeping the route/query-param choreography honest across refactors.

const detailPageSource = readFileSync(
  new URL("../app/app/knowledge-bases/[kbId]/artifacts/[artifactId]/page.tsx", import.meta.url),
  "utf8",
);
const detailHelperSource = readFileSync(
  new URL("../lib/artifacts/detail.ts", import.meta.url),
  "utf8",
);
const chatSource = readFileSync(
  new URL("../components/app/chat-interface.tsx", import.meta.url),
  "utf8",
);
const chatPageSource = readFileSync(
  new URL("../app/app/knowledge-bases/[kbId]/chat/page.tsx", import.meta.url),
  "utf8",
);
const listSource = readFileSync(
  new URL("../components/app/studio/artifact-list.tsx", import.meta.url),
  "utf8",
);
const studioSource = readFileSync(
  new URL("../components/app/studio/artifact-studio.tsx", import.meta.url),
  "utf8",
);
const dialogSource = readFileSync(
  new URL("../components/app/studio/artifact-dialog.tsx", import.meta.url),
  "utf8",
);
const contentSource = readFileSync(
  new URL("../components/app/studio/artifact-content.tsx", import.meta.url),
  "utf8",
);
const detailClientSource = readFileSync(
  new URL("../components/app/studio/artifact-detail-client.tsx", import.meta.url),
  "utf8",
);

describe("artifact detail route", () => {
  it("has a server page at the canonical deep-link path with session gating", () => {
    assert.match(detailPageSource, /next\/navigation/);
    assert.match(detailPageSource, /redirect\("\/login"\)/);
    assert.match(detailPageSource, /getServerSession/);
  });

  it("renders the safe not-found for anything unreadable and never hits a database directly", () => {
    assert.match(detailPageSource, /getArtifactDetailForUser/);
    assert.match(detailPageSource, /if \(!detail\) notFound\(\)/);
    assert.doesNotMatch(detailPageSource, /from ["']@\/lib\/prisma["']/);
  });

  it("validates the return conversation at the server boundary, never trusting the query param", () => {
    assert.match(detailPageSource, /resolveArtifactReturnTarget/);
    assert.match(detailHelperSource, /canUseConversationInKb/);
    assert.match(detailHelperSource, /canAccessKnowledgeBase/);
    assert.match(detailHelperSource, /getLearningArtifactInKb/);
    // Server-side persistence goes through the existing prisma singleton, not
    // a raw/new connection — the detail helpers never open their own client.
    assert.match(detailHelperSource, /from ["']@\/lib\/prisma["']/);
  });

  it("never touches a database from the browser-side of the page", () => {
    assert.doesNotMatch(detailPageSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(detailClientSource, /prisma/i);
    assert.doesNotMatch(contentSource, /prisma/i);
  });

  it("reuses the DTO projection that strips podcast storage references", () => {
    assert.match(detailHelperSource, /toWorkspaceArtifactData/);
  });

  it("passes the validated conversation back to the client as the return target", () => {
    assert.match(detailClientSource, /returnConversationId/);
    assert.match(detailClientSource, /\?conversation=\$\{returnConversationId\}/);
  });

  it("has a loading skeleton in place", () => {
    const loadingSource = readFileSync(
      new URL("../app/app/knowledge-bases/[kbId]/artifacts/[artifactId]/loading.tsx", import.meta.url),
      "utf8",
    );
    assert.match(loadingSource, /Loader2/);
  });
});

describe("chat → artifact deep link", () => {
  it("sends an identifier shaped like a conversation id before it is trusted", () => {
    assert.equal(isValidEntityId("a".repeat(32)), true);
    assert.equal(isValidEntityId("../../etc/passwd"), false);
    assert.equal(isValidEntityId(""), false);
  });

  it("deep-links the freshly created artifact straight to its detail route", () => {
    assert.match(chatSource, /knowledge-bases\/\$\{kbId\}\/artifacts\/\$\{createdArtifact\.id\}/);
  });

  it("carries the active conversation back so the return link can restore it", () => {
    assert.match(chatSource, /\?conversation=\$\{activeConversation\}/);
  });

  it("no longer routes 'View' through the generic studio page", () => {
    assert.doesNotMatch(chatSource, /View in Studio/);
  });

  it("seeds the chat page with the deep-linked conversation from searchParams", () => {
    assert.match(chatPageSource, /searchParams/);
    assert.match(chatPageSource, /isValidEntityId/);
    assert.match(chatPageSource, /initialConversationId=\{conversationId\}/);
    assert.match(chatSource, /initialConversationId/);
  });
});

describe("studio → artifact detail page", () => {
  it("renders the View action as a next/link to the canonical route", () => {
    assert.match(listSource, /artifacts\/\$\{artifact\.id\}/);
  });

  it("no longer opens artifacts through a callback", () => {
    assert.doesNotMatch(listSource, /onOpen/);
    assert.doesNotMatch(listSource, /onOpen=/);
  });

  it("keeps the auto-open dialog for freshly generated artifacts", () => {
    assert.match(studioSource, /setOpenArtifactId\(artifact\.id\)/);
    assert.match(studioSource, /setOpenArtifactId\(next\.id\)/);
  });
});

describe("shared artifact content rendering", () => {
  it("routes every active artifact type through exactly one shared component", () => {
    assert.match(contentSource, /ARTIFACT_TYPE_VIEWERS/);
    for (const type of ["SUMMARY", "REPORT", "QUIZ", "FLASHCARDS", "MINDMAP", "TAKEAWAYS", "PODCAST"]) {
      assert.match(contentSource, new RegExp(`${type}: \\w+Viewer`));
    }
  });

  it("animates the dialog through the same shared content as the detail page", () => {
    assert.match(dialogSource, /ArtifactContent/);
    assert.doesNotMatch(dialogSource, /SummaryArtifactViewer artifact=\{artifact\}/);
  });
});