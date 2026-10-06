// Tenant isolation for the v1 experiments API against a real database:
// binding an experiment to a dataset must never attach it to another
// tenant's dataset. Only datasets anchored to the caller's organization or
// knowledge base (or intentionally unanchored standalone material) are
// bindable; a foreign dataset id must resolve to 404 so its existence cannot
// be probed.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { createApiKey } from "@/lib/api-keys";
import { POST as createExperimentPOST } from "@/app/api/v1/experiments/route";
import { GET as getExperiment } from "@/app/api/v1/experiments/[id]/route";

if (process.env.NODE_ENV !== "production") {
  process.env.KAIROS_DEMO_MODE = "true";
}

describe("v1 experiments dataset tenancy against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectB = randomUUID();
  let kbA: string;
  let kbB: string;

  let client: PrismaClient;
  let demoId: string;
  let apiKey: string;
  let ownDatasetId: string;
  let foreignOrgDatasetId: string;
  let foreignKbDatasetId: string;
  let unanchoredDatasetId: string;

  function requireEnvironment(t: { skip: (message?: string) => void }): boolean {
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

  function postExperiment(body: unknown) {
    const req = new NextRequest("http://localhost/api/v1/experiments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
    });
    return createExperimentPOST(req);
  }

  before(async () => {
    if (!testDbUrl) return;
    client = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await client.$connect();

    demoId = await ensureDemoUser();
    await client.organization.create({
      data: {
        id: orgA,
        name: "V1 Tenancy Org A",
        slug: `v1-tenancy-a-${randomUUID()}`,
        ownerId: demoId,
        members: { create: { userId: demoId, role: "OWNER" } },
      },
    });
    await client.organization.create({
      data: {
        id: orgB,
        name: "V1 Tenancy Org B",
        slug: `v1-tenancy-b-${randomUUID()}`,
        ownerId: demoId,
      },
    });
    await client.project.create({
      data: { id: projectA, name: "V1 Tenancy Project A", slug: `v1-tenancy-pa-${randomUUID()}`, organizationId: orgA },
    });
    await client.project.create({
      data: { id: projectB, name: "V1 Tenancy Project B", slug: `v1-tenancy-pb-${randomUUID()}`, organizationId: orgB },
    });
    kbA = (await client.knowledgeBase.create({
      data: { name: "V1 Tenancy KB A", projectId: projectA, retrievalConfig: {} },
    })).id;
    kbB = (await client.knowledgeBase.create({
      data: { name: "V1 Tenancy KB B", projectId: projectB, retrievalConfig: {} },
    })).id;

    ownDatasetId = (await client.benchmarkDataset.create({
      data: { name: "Own Dataset", organizationId: orgA },
    })).id;
    foreignOrgDatasetId = (await client.benchmarkDataset.create({
      data: { name: "Foreign Org Dataset B", organizationId: orgB },
    })).id;
    foreignKbDatasetId = (await client.benchmarkDataset.create({
      data: { name: "Foreign KB Dataset B", knowledgeBaseId: kbB },
    })).id;
    unanchoredDatasetId = (await client.benchmarkDataset.create({
      data: { name: "Shared Standalone Dataset" },
    })).id;

    apiKey = (await createApiKey(demoId, orgA, { name: "v1-experiment-tenancy", scopes: ["experiment"] })).key;
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      const datasetIds = [ownDatasetId, foreignOrgDatasetId, foreignKbDatasetId, unanchoredDatasetId];
      await client.experiment.deleteMany({ where: { knowledgeBaseId: { in: [kbA, kbB] } } });
      await client.benchmarkDataset.deleteMany({ where: { id: { in: datasetIds } } });
      await client.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("rejects a dataset anchored to another organization with 404 and creates nothing", async (t) => {
    if (!requireEnvironment(t)) return;
    const name = `foreign-org-${randomUUID()}`;

    const res = await postExperiment({ name, knowledgeBaseId: kbA, datasetId: foreignOrgDatasetId });
    assert.equal(res.status, 404);
    const { error } = await res.json();
    assert.equal(error, "datasetId not found");

    const persisted = await client.experiment.count({ where: { name, datasetId: foreignOrgDatasetId } });
    assert.equal(persisted, 0, "a refused experiment must not be created");
  });

  it("rejects a dataset anchored to another organization's knowledge base with 404", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await postExperiment({ name: `foreign-kb-${randomUUID()}`, knowledgeBaseId: kbA, datasetId: foreignKbDatasetId });
    assert.equal(res.status, 404);
  });

  it("rejects a fabricated dataset id with 404", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await postExperiment({ name: `fabricated-${randomUUID()}`, knowledgeBaseId: kbA, datasetId: "cm-0000not-real0000" });
    assert.equal(res.status, 404);
  });

  it("accepts a dataset anchored to the caller's organization and surfaces it on GET", async (t) => {
    if (!requireEnvironment(t)) return;
    const name = `own-${randomUUID()}`;

    const res = await postExperiment({ name, knowledgeBaseId: kbA, datasetId: ownDatasetId });
    assert.equal(res.status, 201);
    const experiment = await res.json();
    assert.equal(experiment.datasetId, ownDatasetId);

    const getReq = new NextRequest(`http://localhost/api/v1/experiments/${experiment.id}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });
    const getRes = await getExperiment(getReq, { params: Promise.resolve({ id: experiment.id }) } as never);
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.dataset.id, ownDatasetId);
    assert.equal(fetched.dataset.name, "Own Dataset");
  });

  it("accepts an unanchored standalone dataset, matching the UI's dataset access boundary", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await postExperiment({ name: `unanchored-${randomUUID()}`, knowledgeBaseId: kbA, datasetId: unanchoredDatasetId });
    assert.equal(res.status, 201);
  });
});