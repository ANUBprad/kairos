import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSelectedOrganization } from "@/lib/workspace-selection";

const layoutSource = readFileSync(
  new URL("../app/app/layout.tsx", import.meta.url),
  "utf8",
);

const sidebarSource = readFileSync(
  new URL("../components/app/sidebar.tsx", import.meta.url),
  "utf8",
);

const demoUserSource = readFileSync(
  new URL("../lib/server/demo-user.ts", import.meta.url),
  "utf8",
);

const orgActionsSource = readFileSync(
  new URL("../lib/actions/organization.ts", import.meta.url),
  "utf8",
);

const serverOrgSource = readFileSync(
  new URL("../lib/server/organization.ts", import.meta.url),
  "utf8",
);

const kbSource = readFileSync(
  new URL("../lib/actions/knowledge-base.ts", import.meta.url),
  "utf8",
);

const THE_ORGS = [
  { id: "org-a", name: "Org A", slug: "org-a" },
  { id: "org-b", name: "Org B", slug: "org-b" },
] as { id: string; name: string; slug: string }[];

describe("workspace context selection", () => {
  it("honors a persisted selection the user still belongs to", () => {
    assert.deepEqual(resolveSelectedOrganization(THE_ORGS, "org-b"), {
      id: "org-b",
      name: "Org B",
      slug: "org-b",
    });
  });

  it("falls back to the first organization for a foreign or stale selection", () => {
    const foreign = resolveSelectedOrganization(THE_ORGS, "org-foreign");
    assert.equal(foreign?.id, "org-a");
    const stale = resolveSelectedOrganization(THE_ORGS, null);
    assert.equal(stale?.id, "org-a");
  });

  it("never returns an org the user is not a member of", () => {
    const selected = resolveSelectedOrganization(THE_ORGS, "org-foreign");
    assert.ok(THE_ORGS.includes(selected as (typeof THE_ORGS)[number]));
  });

  it("returns null when the user has no organizations", () => {
    assert.equal(resolveSelectedOrganization([], "org-a"), null);
  });
});

describe("shell uses the real workspace context, never demo data", () => {
  it("the /app layout loads the workspace context instead of demo org lookup", () => {
    assert.doesNotMatch(layoutSource, /getDemoOrgAndProject/);
    assert.match(layoutSource, /getWorkspaceContext/);
  });

  it("the /app layout passes the user's organizations to the sidebar for switching", () => {
    assert.match(layoutSource, /organizations=\{workspace\?\.organizations \?\? \[\]\}/);
    assert.match(sidebarSource, /organizations/);
  });

  it("demo identity is still gated behind the explicit demo-mode flag", () => {
    assert.doesNotMatch(demoUserSource, /export async function getDemoOrgAndProject/);
    assert.match(demoUserSource, /isDemoModeEnabled/);
    assert.match(demoUserSource, /export async function getDemoSession/);
  });
});

describe("workspace context is the single organization anchor", () => {
  it("ensureDefaultOrg resolves through the shared workspace context", () => {
    assert.match(serverOrgSource, /getWorkspaceContext/);
    assert.doesNotMatch(serverOrgSource, /session\.user\.id/);
  });

  it("the workspace switch action validates membership before persisting", () => {
    assert.match(orgActionsSource, /switchWorkspaceOrganization/);
    assert.match(orgActionsSource, /getMembership\(session\.user\.id, organizationId\)/);
    assert.match(orgActionsSource, /APP_WORKSPACE_ORG_COOKIE/);
    assert.match(orgActionsSource, /revalidatePath\("\/app", "layout"\)/);
  });

  it("knowledge-base creation no longer depends on the seed fixture", () => {
    assert.doesNotMatch(kbSource, /Run `npx prisma db seed`/);
  });
});