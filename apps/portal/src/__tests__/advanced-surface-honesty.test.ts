import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_API_KEYS_PER_USER } from "@/lib/api-keys";

// Advanced surfaces must describe what the code actually does. These contracts
// fail if a page reintroduces inert buttons, invented limits, or statistical
// claims the pipeline never computed.

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const securityPage = source("../app/app/settings/security/page.tsx");
const security = source("../app/app/settings/security/security-settings-client.tsx");
const settings = source("../app/app/settings/settings-client.tsx");
const notebook = source("../app/app/notebook/notebook-client.tsx");
const research = source("../app/app/research/analytics/research-client.tsx");
const researchPage = source("../app/app/research/analytics/page.tsx");

describe("security settings honesty", () => {
  it("reports the real API key limit instead of a hardcoded 10", () => {
    assert.equal(MAX_API_KEYS_PER_USER, 50);
    assert.match(securityPage, /MAX_API_KEYS_PER_USER/);
    assert.match(security, /\{maxKeys\}/);
    assert.doesNotMatch(security, />10</);
  });

  it("has no fake loading spinner and no inert password or 2FA buttons", () => {
    assert.doesNotMatch(security, /Simulate loading/);
    assert.doesNotMatch(security, /setTimeout/);
    assert.doesNotMatch(security, />Change Password</);
    assert.doesNotMatch(security, />Enable 2FA</);
    assert.doesNotMatch(security, /<button/);
    assert.match(security, /not implemented yet/);
    assert.match(security, /does not include a two-factor provider/);
  });

  it("does not claim a per-device session list it cannot show", () => {
    assert.doesNotMatch(security, /Active Sessions/);
    assert.doesNotMatch(security, /Last active: Just now/);
  });
});

describe("configuration page honesty", () => {
  it("does not render provider/model controls that discard the selection", () => {
    assert.doesNotMatch(settings, /type="radio"/);
    assert.doesNotMatch(settings, /<select/);
    assert.doesNotMatch(settings, /setSelectedProvider/);
    assert.match(settings, /does not store per-user\s+overrides/);
  });

  it("still shows real environment availability", () => {
    assert.match(settings, /\/api\/ai\/settings/);
    assert.match(settings, /Configured/);
    assert.match(settings, /Not configured/);
  });
});

describe("research notebook honesty", () => {
  it("describes plain notes, not charts or experiment references it cannot store", () => {
    assert.match(notebook, /plain-text research notes/);
    assert.doesNotMatch(notebook, /with charts, tables, and experiment references/);
  });

  it("has no dead '#' next action", () => {
    assert.doesNotMatch(notebook, /href: "#"/);
    assert.doesNotMatch(notebook, /href="#"/);
  });

  it("lets a note be written, not only titled", () => {
    assert.match(notebook, /<textarea/);
    assert.match(notebook, /content: e\.target\.value/);
    assert.match(notebook, /placeholder="Write your note/);
  });
});

describe("research analytics honesty", () => {
  it("does not claim configurations are equivalent without an equivalence test", () => {
    assert.doesNotMatch(research, /Equivalent Configurations/);
    assert.doesNotMatch(research, /equivalentConfigurations/);
    assert.doesNotMatch(research, /no significant differences/);
    assert.doesNotMatch(researchPage, /equivalentConfigurations/);
  });

  it("replaces the invented health percentage with a setup checklist", () => {
    assert.doesNotMatch(research, /Research Health/);
    assert.doesNotMatch(research, /healthScore/);
    assert.match(research, /readinessSteps/);
    assert.match(research, /Setup steps/);
  });

  it("keeps the significance analysis that is actually computed", () => {
    assert.match(researchPage, /compareMetrics\(/);
    assert.match(research, /Significant Improvements/);
    assert.match(research, /Confidence Intervals/);
  });
});
