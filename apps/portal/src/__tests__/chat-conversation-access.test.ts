import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canUseConversationInKb } from "@/lib/ai/chat/access";

const OWNER = "user_cuid_1";
const OTHER = "user_cuid_2";
const KB_A = "kb_cuid_a";
const KB_B = "kb_cuid_b";

describe("canUseConversationInKb", () => {
  it("allows the owner inside the conversation's own KB", () => {
    assert.equal(canUseConversationInKb({ userId: OWNER, knowledgeBaseId: KB_A }, OWNER, KB_A), true);
  });
  it("rejects another user", () => {
    assert.equal(canUseConversationInKb({ userId: OWNER, knowledgeBaseId: KB_A }, OTHER, KB_A), false);
  });
  it("rejects a conversation from a different KB (cross-workspace)", () => {
    assert.equal(canUseConversationInKb({ userId: OWNER, knowledgeBaseId: KB_A }, OWNER, KB_B), false);
  });
  it("returns false for a missing conversation", () => {
    assert.equal(canUseConversationInKb(null, OWNER, KB_A), false);
  });
  it("returns false for an undefined conversation", () => {
    assert.equal(canUseConversationInKb(undefined, OWNER, KB_A), false);
  });
});