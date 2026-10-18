import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// No mandatory accounts: a public visitor must reach and use the workspace
// without signing in. These assertions pin the wiring that makes that true and
// guard against a re-introduced sign-in wall. Behavioural coverage of the same
// flow against a live database lives in anonymous-session.integration.test.ts.

function sourceFile(relativePath: string): string {
  return readFileSync(path.resolve(relativePath), "utf8");
}

const appLayout = sourceFile("src/app/app/layout.tsx");
const sessionRoute = sourceFile("src/app/api/session/route.ts");
const authConfig = sourceFile("src/lib/server/auth.ts");
const authClient = sourceFile("src/lib/auth-client.ts");
const userMenu = sourceFile("src/components/app/user-menu.tsx");
const schema = sourceFile("prisma/schema.prisma");

// Every nested page that used to carry its own redirect gate.
const gatedPages = [
  "src/app/app/research/page.tsx",
  "src/app/app/studio/page.tsx",
  "src/app/app/study/page.tsx",
  "src/app/app/knowledge-bases/[kbId]/study/page.tsx",
  "src/app/app/knowledge-bases/[kbId]/artifacts/[artifactId]/page.tsx",
];

function anonymousMigrationSql(): string {
  const dir = readdirSync(path.resolve("prisma/migrations"), { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && entry.name.includes("add_anonymous_user"),
  );
  assert.ok(dir, "an additive anonymous-user migration must exist");
  return sourceFile(path.join("prisma/migrations", dir.name, "migration.sql"));
}

describe("no mandatory accounts", () => {
  it("the /app layout bootstraps an anonymous session instead of a login gate", () => {
    assert.match(appLayout, /getServerSession/);
    assert.match(appLayout, /redirect\(\s*["']\/api\/session["']\s*\)/);
    assert.ok(
      !/redirect\(\s*["']\/login["']\s*\)/.test(appLayout),
      "/app must not redirect to /login",
    );
    assert.match(appLayout, /isAnonymous/, "the layout must surface anonymous identity");
  });

  it("strips the redundant page-level login gates", () => {
    for (const page of gatedPages) {
      const src = sourceFile(page);
      assert.ok(
        !/redirect\(\s*["']\/login["']\s*\)/.test(src),
        `${page} must not gate on /login`,
      );
      assert.match(src, /redirect\(\s*["']\/api\/session["']\s*\)/);
    }
  });

  it("the bootstrap endpoint issues an isolated anonymous session, rate-limited", () => {
    assert.match(sessionRoute, /export async function GET/);
    assert.match(sessionRoute, /auth\.api\.signInAnonymous/);
    assert.match(sessionRoute, /rateLimit\(/);
    assert.match(sessionRoute, /RATE_LIMITS\.auth/);
    assert.match(sessionRoute, /getSetCookie\(\)/, "must forward the session cookie");
    assert.match(sessionRoute, /NextResponse\.redirect\(new URL\("\/app"/);
  });

  it("enables the anonymous plugin and never deletes anonymous work", () => {
    assert.match(authConfig, /from\s+["']better-auth\/plugins["']/);
    assert.match(authConfig, /anonymous\(\{/);
    assert.match(
      authConfig,
      /disableDeleteAnonymousUser:\s*true/,
      "anonymous users must survive account linking (User -> Org cascade)",
    );
  });

  it("registers the anonymous client plugin", () => {
    assert.match(authClient, /anonymousClient\(\)/);
  });

  it("declares the anonymous flag in the schema and materializes it by migration", () => {
    assert.match(schema, /isAnonymous\s+Boolean\s+@default\(false\)/);
    const sql = anonymousMigrationSql();
    assert.match(sql, /ALTER TABLE "User" ADD COLUMN "isAnonymous"/);
    assert.ok(
      !/DROP\s+(TABLE|COLUMN)/i.test(sql),
      "the anonymous migration must be additive",
    );
  });

  it("offers an optional account, not sign-out, to anonymous visitors", () => {
    assert.match(userMenu, /isAnonymous/);
    assert.match(userMenu, /href="\/signup"/, "anonymous visitors get a create-account CTA");
    assert.match(userMenu, /href="\/login"/, "anonymous visitors can still sign in");
  });
});
