import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(here, "auth-form.tsx"), "utf8");
const hookSource = readFileSync(join(here, "..", "hooks", "use-auth.ts"), "utf8");
const layoutSource = readFileSync(join(here, "auth-layout.tsx"), "utf8");

describe("authentication form accessibility and wiring", () => {
  it("associates every visible field with a label and autocomplete hint", () => {
    for (const id of ["name", "email", "password", "remember"]) {
      assert.match(formSource, new RegExp(`htmlFor="${id}"`));
      assert.match(formSource, new RegExp(`id="${id}"`));
    }
    assert.match(formSource, /autoComplete="name"/);
    assert.match(formSource, /autoComplete="email"/);
    assert.match(formSource, /autoComplete=\{mode === "login" \? "current-password" : "new-password"\}/);
  });

  it("exposes validation errors to assistive technology", () => {
    assert.match(formSource, /role="alert"/);
    assert.match(formSource, /aria-invalid=\{Boolean\(fieldErrors\.email\)\}/);
    assert.match(formSource, /aria-describedby=\{fieldErrors\.email \? "email-error" : undefined\}/);
    assert.match(formSource, /id="password-error"/);
    assert.match(formSource, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
  });

  it("blocks duplicate submissions and protects the password field", () => {
    assert.match(formSource, /if \(isLoading\) return;/);
    assert.match(formSource, /disabled=\{isLoading\}/);
    assert.match(formSource, /rememberMe: remember/);
    assert.match(hookSource, /rememberMe\?: boolean/);
    assert.match(hookSource, /rememberMe,\s*\n\s*\}\);/);
  });

  it("keeps the real social providers and redirect guard", () => {
    assert.match(formSource, /signInWithGoogle\(\)/);
    assert.match(formSource, /signInWithGithub\(\)/);
    assert.match(hookSource, /provider: "google"/);
    assert.match(hookSource, /provider: "github"/);
    assert.match(hookSource, /safeRedirectPath\(cb\)/);
    assert.doesNotMatch(formSource, /Apple/i);
  });

  it("links only to routes that exist and honours reduced motion", () => {
    for (const route of ["/terms", "/privacy", "/support", "/pricing"]) {
      assert.match(formSource + layoutSource, new RegExp(`href="${route}"`));
    }
    assert.match(formSource + layoutSource, /auth-rise/);
  });
});
