import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { resolveUserWorkspace } from "@/lib/server/workspace";
import { getMembershipForResource } from "@/lib/rbac";

// No account required: a visitor who never signs up still gets a real
// workspace. The first use provisions a personal organization (OWNER + a
// default project), and the authorization gate treats a foreign knowledge base
// exactly like a missing one — so two anonymous visitors can never read each
// other's work. Skips cleanly without a database.

const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

describe("anonymous workspace isolation", () => {
  const aliceId = randomUUID();
  const bobId = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    client = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await client.$connect();
    await client.user.createMany({
      data: [
        { id: aliceId, email: `anon-alice-${randomUUID()}@test.local`, name: "Guest", isAnonymous: true },
        { id: bobId, email: `anon-bob-${randomUUID()}@test.local`, name: "Guest", isAnonymous: true },
      ],
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      // User -> Organization cascades, so this tears down the provisioned orgs too.
      await client.user.deleteMany({ where: { id: { in: [aliceId, bobId] } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("provisions an isolated workspace per anonymous visitor and denies cross-visitor reads", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }

    const alice = await resolveUserWorkspace(aliceId, { name: "Guest" }, null);
    const bob = await resolveUserWorkspace(bobId, { name: "Guest" }, null);
    assert.ok(alice?.selectedOrganization && bob?.selectedOrganization, "each visitor gets a workspace");
    assert.notEqual(
      alice.selectedOrganization.id,
      bob.selectedOrganization.id,
      "each anonymous visitor must get their own organization"
    );

    // Provisioning is idempotent: revisiting the workspace must not mint a second org.
    const aliceAgain = await resolveUserWorkspace(aliceId, { name: "Guest" }, null);
    assert.equal(aliceAgain?.organizations.length, 1, "returning must reuse the provisioned organization");

    const project = await client.project.findFirst({
      where: { organizationId: alice.selectedOrganization.id },
    });
    assert.ok(project, "the provisioned workspace must contain a default project");

    // The visitor creates their own knowledge base — the exact write a first-run
    // user performs after the workspace opens.
    const kb = await client.knowledgeBase.create({
      data: { name: "My notes", projectId: project.id },
    });

    const own = await getMembershipForResource(aliceId, "knowledge_base", kb.id);
    assert.ok(own, "the owner must resolve their own knowledge base");
    assert.equal(own.role, "OWNER");

    const foreign = await getMembershipForResource(bobId, "knowledge_base", kb.id);
    assert.equal(foreign, null, "a foreign visitor must not resolve another visitor's knowledge base");

    const bobProject = await client.project.findFirst({
      where: { organizationId: bob.selectedOrganization.id },
    });
    assert.ok(bobProject, "the second visitor also gets a default project");
    const bobKbs = await client.knowledgeBase.count({ where: { projectId: bobProject.id } });
    assert.equal(bobKbs, 0, "the second visitor must not see the first visitor's knowledge base");
  });
});
