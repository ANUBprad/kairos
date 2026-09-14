import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Pages exist and export a default page component wired to the shared
// Better Auth flow. Importing the modules is safe outside a request scope;
// the session checks run inside the page component, not at import time.
import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";

function sourceFile(relativePath: string): string {
  return readFileSync(path.resolve(relativePath), "utf8");
}

const appLayout = sourceFile("src/app/app/layout.tsx");
const userMenu = sourceFile("src/components/app/user-menu.tsx");
const loginForm = sourceFile("src/components/auth/login-form.tsx");
const signupForm = sourceFile("src/components/auth/signup-form.tsx");

describe("auth UX wiring", () => {
  it("exposes /login and /signup pages", () => {
    assert.equal(typeof LoginPage, "function");
    assert.equal(typeof SignupPage, "function");
  });

  it("login and signup are publicly reachable (session gate lives at /app, not at the auth pages)", () => {
    const login = sourceFile("src/app/(auth)/login/page.tsx");
    const signup = sourceFile("src/app/(auth)/signup/page.tsx");
    for (const page of [login, signup]) {
      assert.ok(!/redirect\(\s*["']\/login["']/.test(page), "auth pages must not redirect to /login");
    }
  });

  it("auth pages redirect an already-authenticated visitor into the app", () => {
    const login = sourceFile("src/app/(auth)/login/page.tsx");
    const signup = sourceFile("src/app/(auth)/signup/page.tsx");
    for (const page of [login, signup]) {
      assert.match(page, /getServerSession/);
      assert.match(page, /redirect\(\s*["']\/app["']/);
    }
  });

  it("login and signup forms submit through the shared Better Auth client", () => {
    assert.match(loginForm, /@\/lib\/auth-client/);
    assert.match(loginForm, /authClient\.signIn\.email/);
    assert.match(signupForm, /@\/lib\/auth-client/);
    assert.match(signupForm, /authClient\.signUp\.email/);
  });

  it("the /app shell gates every route on the server session", () => {
    assert.match(appLayout, /getServerSession/);
    assert.match(appLayout, /redirect\(\s*["']\/login["']\s*\)/);
  });

  it("the /app shell derives identity from the server session, not a hardcoded demo user", () => {
    assert.ok(!appLayout.includes("demo@kairos.dev"));
    assert.ok(!userMenu.includes("demo@kairos.dev"));
    assert.match(appLayout, /email=\{session\.user\.email\}/);
    assert.match(appLayout, /name=\{session\.user\.name\}/);
  });

  it("logout runs through the server-side Better Auth action", () => {
    assert.match(userMenu, /authClient\.signOut/);
    assert.match(userMenu, /router\.push\(\s*["']\/login["']/);
  });

  it("the shell no longer fabricates a Demo User display name", () => {
    assert.ok(!userMenu.includes("Demo User"));
  });
});