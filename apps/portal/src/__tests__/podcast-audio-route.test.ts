import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isValidEntityId } from "@/lib/validation";

const EPISODE_ROUTE_SOURCE = readFileSync(
  new URL("../app/api/artifacts/[artifactId]/audio/route.ts", import.meta.url),
  "utf8",
);
const INTERRUPTION_ROUTE_SOURCE = readFileSync(
  new URL("../app/api/artifacts/[artifactId]/audio/interruption/[interruptionId]/route.ts", import.meta.url),
  "utf8",
);

// Real persisted ids: LearningArtifact is String @id @default(cuid()), so a
// podcast episode id is cuid-shaped; interruption ids are randomUUID().
const CUID_ARTIFACT_ID = "clx8xhf4j00008e5j2n0o5u5x";
const UUID_INTERRUPTION_ID = "55c6424c-a555-4e14-8c82-9c2d2bd8eb0a";
const UUID_ARTIFACT_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("podcast audio route artifact id validation", () => {
  it("accepts a real cuid artifact id (the width of a persisted LearningArtifact)", () => {
    assert.equal(isValidEntityId(CUID_ARTIFACT_ID), true);
  });

  it("accepts a uuid artifact id only through the shared helper's documented tolerance", () => {
    assert.equal(isValidEntityId(UUID_ARTIFACT_ID), true);
  });

  it("rejects malformed artifact ids instead of accepting arbitrary strings", () => {
    assert.equal(isValidEntityId(""), false);
    assert.equal(isValidEntityId("clx artifact"), false);
    assert.equal(isValidEntityId("clx-artifact!"), false);
    assert.equal(isValidEntityId("../clx-artifact"), false);
    assert.equal(isValidEntityId("x".repeat(129)), false);
  });

  it("validates the episode route's artifactId with the shared entity-id helper, not a uuid-only regex", () => {
    assert.match(EPISODE_ROUTE_SOURCE, /isValidEntityId\(artifactId\)/);
    assert.doesNotMatch(EPISODE_ROUTE_SOURCE, /UUID_REGEX/);
  });

  it("gives the interruption route the same artifactId fix while keeping the uuid-only interruption check", () => {
    assert.match(INTERRUPTION_ROUTE_SOURCE, /isValidEntityId\(artifactId\) \|\| !UUID_REGEX\.test\(interruptionId\)/);
  });

  it("keeps uuid validation for interruption ids, which are genuinely randomUUID()", () => {
    assert.match(UUID_INTERRUPTION_ID, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.doesNotMatch(CUID_ARTIFACT_ID, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe("podcast audio route security surface", () => {
  it("keeps session authentication and the 401 semantics on both routes", () => {
    for (const routeSource of [EPISODE_ROUTE_SOURCE, INTERRUPTION_ROUTE_SOURCE]) {
      assert.match(routeSource, /getServerSession/);
      assert.match(routeSource, /Not authenticated/);
      assert.match(routeSource, /status: 401/);
    }
  });

  it("keeps knowledge-base tenancy on both routes, resolving foreign access to 404", () => {
    for (const routeSource of [EPISODE_ROUTE_SOURCE, INTERRUPTION_ROUTE_SOURCE]) {
      assert.match(routeSource, /canAccessKnowledgeBase\(session\.user\.id, artifact\.knowledgeBaseId\)/);
      assert.match(routeSource, /artifact\.type !== "PODCAST"/);
      assert.match(routeSource, /status: 404/);
    }
  });

  it("keeps the interruption audio scoped to the podcast's persisted history", () => {
    assert.match(INTERRUPTION_ROUTE_SOURCE, /parseStoredInterruptions\(artifact\.metadata\)\.find/);
    assert.match(INTERRUPTION_ROUTE_SOURCE, /entry\.id === interruptionId/);
  });
});