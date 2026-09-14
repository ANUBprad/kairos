import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actionSource = readFileSync(
  new URL("../lib/actions/organization.ts", import.meta.url),
  "utf8",
);

const libSource = readFileSync(
  new URL("../lib/organizations.ts", import.meta.url),
  "utf8",
);

describe("organization member administration authorization wiring", () => {
  it("passes the server-session identity as the grantor to addMember", () => {
    assert.match(actionSource, /addMember\(organizationId, userId, role, session\.user\.id\)/);
  });

  it("requires an authenticated session before add member can run", () => {
    const addIdx = actionSource.indexOf("await addMember(organizationId, userId, role, session.user.id)");
    assert.ok(addIdx > actionSource.indexOf("if (!session?.user)"));
  });

  it("authorizes the grantor through the manage_members role check before writing a member row", () => {
    const addIdx = libSource.indexOf("export async function addMember(");
    const block = libSource.slice(addIdx, addIdx + 1200);
    assert.match(block, /manage_members/);
    assert.match(block, /isRoleSufficient\(membership\.role, role\)/);
  });

  it("keeps the invitation-acceptance path from requiring an administrator grantor", () => {
    assert.match(
      libSource,
      /await addMember\(invitation\.organizationId, userId, invitation\.role as MemberRole\)/,
    );
    assert.doesNotMatch(libSource, /invitation\.organizationId[\s\S]{0,120}invitedBy/);
  });

  it("scopes role and removal mutations to the caller's organization", () => {
    const scopePattern = /member\.findFirst\(\{[\s\S]{0,120}where: \{ id: memberId, organizationId \}/g;
    assert.equal(libSource.match(scopePattern)?.length ?? 0, 2);
  });
});