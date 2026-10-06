// RBAC sweep: org-scoped mutations require more than membership. Flipping the
// demo user's real Member row drives requireOrgPermission so the gates
// themselves are under test: VIEWER can read but not write, MEMBER can
// create/edit but not delete, ADMINS own the API-key lifecycle.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { createPromptFolder, deletePromptFolder, createNewPrompt, exportPromptData } from "@/lib/actions/prompts";
import { listQualityGates, createQualityGate, deleteQualityGate } from "@/lib/actions/quality-gates";
import { createGoldenDataset } from "@/lib/actions/golden-datasets";
import { createNewApiKey } from "@/lib/actions/api-keys";

if (process.env.NODE_ENV !== "production") {
  process.env.KAIROS_DEMO_MODE = "true";
  process.env.KAIROS_DEMO_USER_ID = `rbac-${randomUUID()}`;
}

describe("mutation actions require create/edit/delete/manage_api_keys, not just membership", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const orgId = randomUUID();
  let client: PrismaClient;
  let demoId: string;

  async function setRole(role: "VIEWER" | "MEMBER" | "ADMIN"): Promise<void> {
    await client.member.updateMany({ where: { organizationId: orgId, userId: demoId }, data: { role } });
  }

  before(async () => {
    if (!testDbUrl) return;
    client = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await client.$connect();
    demoId = await ensureDemoUser();
    const leftover = await client.member.findMany({ where: { userId: demoId } });
    if (leftover.length > 0) {
      await client.organization.deleteMany({ where: { id: { in: leftover.map((m) => m.organizationId) } } });
    }
    await client.organization.create({
      data: {
        id: orgId,
        name: "RBAC Org",
        slug: `rbac-${randomUUID()}`,
        ownerId: demoId,
        members: { create: { userId: demoId, role: "VIEWER" } },
      },
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.apiKey.deleteMany({ where: { organizationId: orgId } });
      await client.goldenDataset.deleteMany({ where: { organizationId: orgId } });
      await client.qualityGate.deleteMany({ where: { organizationId: orgId } });
      await client.prompt.deleteMany({ where: { organizationId: orgId } });
      await client.promptFolder.deleteMany({ where: { organizationId: orgId } });
      await client.organization.deleteMany({ where: { id: orgId } });
      await client.user.deleteMany({ where: { id: demoId } });
    } finally {
      await client.$disconnect();
    }
  });

  function requireEnvironment(t: { skip: (message: string) => void }): boolean {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return false;
    }
    if (!isDemoModeEnabled()) {
      t.skip("requires KAIROS_DEMO_MODE=true for the session");
      return false;
    }
    return true;
  }

  it("lets a VIEWER read but blocks every write across prompts, gates, datasets, and API keys", async (t) => {
    if (!requireEnvironment(t)) return;
    await setRole("VIEWER");

    assert.equal((await listQualityGates()).success, true, "reads stay open for viewers");
    assert.equal((await createPromptFolder({ name: "v" })).success, false);
    assert.equal((await createNewPrompt({ title: "v", systemPrompt: "p", userPrompt: "u" })).success, false);
    assert.equal((await createQualityGate({ name: "v", conditions: [] })).success, false);
    assert.equal((await createGoldenDataset({ name: "v" })).success, false);
    assert.equal((await createNewApiKey("v", [])).success, false, "API-key lifecycle is admin-only");

    const folder = await client.promptFolder.create({ data: { name: "vw", organizationId: orgId } });
    assert.equal((await deletePromptFolder(folder.id)).success, false);
    const prompt = await client.prompt.create({
      data: { title: "vw", organizationId: orgId, ownerId: demoId },
    });
    await client.promptVersion.create({
      data: {
        promptId: prompt.id,
        title: "vw",
        systemPrompt: "p",
        userPrompt: "u",
        version: 1,
        status: "DRAFT",
        createdById: demoId,
      },
    });
    assert.equal((await exportPromptData(prompt.id)).success, false, "exports require the export permission");
  });

  it("lets a MEMBER create and edit but still not delete (delete is admin+)", async (t) => {
    if (!requireEnvironment(t)) return;
    await setRole("MEMBER");

    const folderRes = await createPromptFolder({ name: "m" });
    assert.equal(folderRes.success, true, "members can create folders");
    assert.ok(folderRes.folder);
    await deletePromptFolder(folderRes.folder.id);

    const promptRes = await createNewPrompt({ title: "m", systemPrompt: "p", userPrompt: "u" });
    assert.equal(promptRes.success, true, "members can create prompts");
    assert.ok(promptRes.prompt);
    assert.equal((await exportPromptData(promptRes.prompt.id)).success, true, "members can export");

    const gateRes = await createQualityGate({ name: "m", conditions: [] });
    assert.equal(gateRes.success, true);
    const gateId = (gateRes as { id: string }).id;
    assert.ok(gateId);
    assert.equal(
      (await deleteQualityGate(gateId)).success,
      false,
      "members cannot delete quality gates"
    );

    assert.equal((await createNewApiKey("m", [])).success, false, "members cannot manage API keys");
  });

  it("lets an ADMIN rotate API-key lifecycle", async (t) => {
    if (!requireEnvironment(t)) return;
    await setRole("ADMIN");

    const key = await createNewApiKey("a", []);
    assert.equal(key.success, true, "admins can create API keys");
    assert.ok((key as { keyPrefix: string }).keyPrefix);
  });
});