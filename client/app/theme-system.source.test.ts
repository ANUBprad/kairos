import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const globals = source("./globals.css");

function cssBlock(selector: string): string {
  const start = globals.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} is defined in globals.css`);
  const end = globals.indexOf("\n}", start);
  assert.ok(end > start, `${selector} block is closed`);
  return globals.slice(start, end);
}

const light = cssBlock(":root");
const dark = cssBlock(".dark");

test("central palette contains the approved light tokens", () => {
  for (const token of [
    "--background: #f5f5f5;",
    "--background-secondary: #eeeeee;",
    "--surface: #ffffff;",
    "--surface-elevated: #ffffff;",
    "--surface-hover: #ebebeb;",
    "--panel: #ffffff;",
    "--card: #ffffff;",
    "--card-foreground: #111111;",
    "--popover: #ffffff;",
    "--foreground: #111111;",
    "--foreground-secondary: #525252;",
    "--foreground-muted: #737373;",
    "--primary: #f05a24;",
    "--primary-hover: #d94b19;",
    "--border: #dedede;",
    "--input: #dedede;",
    "--ring: #f05a24;",
  ]) {
    assert.ok(light.includes(token), `${token} is present in the light palette`);
  }
});

test("central palette contains the approved dark tokens", () => {
  for (const token of [
    "--background: #080808;",
    "--background-secondary: #101010;",
    "--surface: #171717;",
    "--surface-elevated: #171717;",
    "--surface-hover: #202020;",
    "--surface-raised: #171717;",
    "--panel: #101010;",
    "--card: #141414;",
    "--card-foreground: #f5f5f5;",
    "--popover: #141414;",
    "--popover-foreground: #f5f5f5;",
    "--foreground: #f5f5f5;",
    "--foreground-secondary: #a3a3a3;",
    "--foreground-muted: #737373;",
    "--primary: #ff6b2c;",
    "--primary-hover: #ff814d;",
    "--border: #292929;",
    "--input: #292929;",
    "--ring: #ff6b2c;",
  ]) {
    assert.ok(dark.includes(token), `${token} is present in the dark palette`);
  }
});

test("legacy color names alias the single semantic token system", () => {
  for (const [theme, block] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    assert.match(block, /--brand: var\(--primary\);/, `${theme} brand alias`);
    assert.match(block, /--brand-accent: var\(--primary\);/, `${theme} brand accent alias`);
    assert.match(block, /--brand-soft: var\(--primary-subtle\);/, `${theme} brand soft alias`);
    assert.match(block, /--navy: var\(--editorial-bg\);/, `${theme} navy alias`);
    assert.match(block, /--navy-card:/, `${theme} navy card alias`);
    assert.match(block, /--processing:/, `${theme} processing alias`);
    assert.match(block, /--processing-rgb:/, `${theme} processing RGB alias`);
    assert.match(block, /--processing-deep-rgb:/, `${theme} deep processing RGB alias`);
    assert.match(block, /--spark-rgb:/, `${theme} spark RGB alias`);
  }
  assert.match(globals, /@custom-variant dark \(&:is\(\.dark, \.dark \*\)\)/);
  assert.match(globals, /\.kairos-dark-section \{[\s\S]*?--background: var\(--editorial-bg\)/);
});

test("app metadata, PWA colors, and brand marks use the unified palette", () => {
  const layout = source("./layout.tsx");
  const manifest = source("./manifest.ts");
  const staticManifest = source("../public/manifest.json");
  const icon = source("./icon.svg");
  const logo = source("../public/logo.svg");

  assert.match(layout, /color: "#F5F5F5"/);
  assert.match(layout, /color: "#080808"/);
  assert.match(manifest, /background_color: "#F5F5F5"/);
  assert.match(manifest, /theme_color: "#080808"/);
  assert.match(staticManifest, /"background_color": "#F5F5F5"/);
  assert.match(staticManifest, /"theme_color": "#080808"/);

  for (const [name, mark] of [
    ["icon.svg", icon],
    ["logo.svg", logo],
  ] as const) {
    assert.match(mark, /fill="#080808"/, `${name} uses the dark background`);
    assert.match(mark, /stroke="#F5F5F5"/, `${name} uses the light ink`);
    assert.match(mark, /fill="#FF6B2C"/, `${name} uses orange`);
    assert.doesNotMatch(mark, /#0B1715|#C8F169|#F3F7F5/i, `${name} drops legacy brand colors`);
  }
});

test("active auth, legal, chat, and billing surfaces avoid legacy color literals", () => {
  const legacyLiteral =
    /#(?:f6f7f4|0a0f14|155e56|c8f169|071225|103b36|e7f0ed|e8663a|0b1715|f3f7f5|101318|4b5563|7b8494|d9dee7|9aa3b2|374151|b42318|6b7280|f3c3bd|fff3f1|e5e8ee|8a94a3|2b3340)\b/i;
  const fixedUtility = /\b(?:bg|text|border|from|via|to)-(?:white|navy|brand-accent)\b/;
  const files = [
    "./layout.tsx",
    "./terms/page.tsx",
    "./privacy/page.tsx",
    "./support/page.tsx",
    "./offline/page.tsx",
    "../components/brand/simple-info-page.tsx",
    "../components/brand/kairos-logo.tsx",
    "../components/ui/chat-markdown.tsx",
    "../features/auth/components/auth-layout.tsx",
    "../features/auth/components/auth-form.tsx",
    "../features/billing/components/premium-avatar.tsx",
    "../features/billing/components/pricing-plans.tsx",
    "../features/billing/hooks/use-razorpay.ts",
    "../features/chat/components/chat-input.tsx",
    "../features/sources/components/add-source-dialog.tsx",
  ];

  for (const file of files) {
    const text = source(file);
    assert.doesNotMatch(text, legacyLiteral, `${file} avoids legacy color literals`);
    assert.doesNotMatch(text, fixedUtility, `${file} avoids fixed theme utilities`);
  }
});

test("pricing preserves server-owned values and the existing checkout path", () => {
  const page = source("./pricing/page.tsx");
  const plans = source("../features/billing/lib/plans.ts");
  const pricingPlans = source("../features/billing/components/pricing-plans.tsx");

  assert.match(page, /<PricingPlans variant="page" showHeader={false} \/>/);
  assert.match(page, /id="pricing-plans"/);
  assert.match(page, /kairos-editorial-title/);

  assert.match(plans, /PRO: 500/);
  assert.match(plans, /PRO_PLUS: 1500/);
  assert.match(pricingPlans, /PLAN_CREDIT_ALLOWANCES/);

  for (const token of [
    "CREDIT_PACKS",
    "PRICING_PLANS",
    "useRazorpayCheckout",
    "requireAuth",
    "handleBuy",
    "handlePlanBuy",
    "checkout({",
    '`/login?redirect=${encodeURIComponent("/pricing")}`',
  ]) {
    assert.ok(pricingPlans.includes(token), `pricing keeps ${token}`);
  }
  assert.doesNotMatch(pricingPlans, /create-order|verify-payment/);
  assert.match(pricingPlans, /data-featured=\{pack\.isPopular/);
  assert.doesNotMatch(pricingPlans, /text-success/);
});

test("portals and overlays inherit the active theme", () => {
  const files = [
    "../components/ui/alert-dialog.tsx",
    "../components/ui/dialog.tsx",
    "../components/ui/sheet.tsx",
    "../components/ui/drawer.tsx",
    "../features/dashboard/components/create-workspace-modal.tsx",
    "../features/dashboard/components/edit-workspace-modal.tsx",
    "../features/sources/components/add-source-dialog.tsx",
    "../features/sources/components/notion-token-guide-modal.tsx",
    "../features/sources/components/source-preview-dialog.tsx",
    "../features/memory/components/add-memory-dialog.tsx",
    "../features/learn/components/artifact-modal.tsx",
    "../features/learn/components/podcast-viewer.tsx",
  ];

  for (const file of files) {
    const text = source(file);
    assert.match(text, /bg-overlay/, `${file} uses the overlay token`);
    assert.doesNotMatch(text, /bg-black\/(?:30|60|65|70)\b/, `${file} has no fixed black scrim`);
  }
});

test("semantic status colors stay distinct from the orange brand", () => {
  for (const [theme, block] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const token of ["--success:", "--warning:", "--danger:", "--info:"]) {
      assert.ok(block.includes(token), `${theme} defines ${token}`);
    }
  }

  const chat = source("../components/ui/chat-markdown.tsx");
  for (const token of ["text-success", "text-warning", "text-info"]) {
    assert.ok(chat.includes(token), `chat markdown uses ${token}`);
  }
  assert.doesNotMatch(chat, /\b(?:text|bg|border)-(?:emerald|amber|sky|zinc)-\d+/);

  const offline = source("./offline/page.tsx");
  assert.match(offline, /text-warning/);
  assert.doesNotMatch(offline, /amber-/);

  const sources = source("../features/sources/components/add-source-dialog.tsx");
  assert.match(sources, /text-warning/);
  assert.doesNotMatch(sources, /amber-/);
});

test("premium accents use orange shimmer with readable foreground", () => {
  assert.match(globals, /\.gold-glitter-badge \{[\s\S]*?var\(--primary\)/);
  assert.match(globals, /\.gold-glitter-ring \{[\s\S]*?var\(--primary\)/);
  assert.doesNotMatch(
    globals,
    /#(?:bf953f|fcf6ba|b38728|fbf5b7|aa771c|d4af37|fff6cc|fef08a)\b/i,
  );

  const avatar = source("../features/billing/components/premium-avatar.tsx");
  assert.match(avatar, /text-primary-foreground/);
  assert.doesNotMatch(avatar, /amber-|from-zinc|via-zinc|to-zinc/);
});
