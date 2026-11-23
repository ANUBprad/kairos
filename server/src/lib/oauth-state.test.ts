import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  getPrimaryClientUrl,
  validateReturnPath,
  verifyOAuthStateSignature,
} from "./oauth-state.js";

const SECRET = "oauth_state_test_secret_32_chars";

function signedToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, uid: "u1", p: "GITHUB", n: "n1", exp: Date.now() + 1000, r: null }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

describe("OAuth state", () => {
  it("accepts only safe relative return paths", () => {
    assert.equal(validateReturnPath("/settings/integrations?tab=github"), "/settings/integrations?tab=github");
    assert.equal(validateReturnPath(undefined), "/settings/integrations");
    assert.throws(() => validateReturnPath("https://evil.example"), /Invalid return path/);
    assert.throws(() => validateReturnPath("//evil.example"), /Invalid return path/);
    assert.throws(() => validateReturnPath("/\\evil"), /Invalid return path/);
    assert.throws(() => validateReturnPath("/settings\nLocation: https://evil.example"), /Invalid return path/);
  });

  it("validates and rejects tampered state signatures", () => {
    process.env.OAUTH_STATE_SECRET = SECRET;
    const token = signedToken();
    const [payload, signature] = token.split(".");
    assert.equal(verifyOAuthStateSignature(token), true);

    const flipped = signature === "A" ? "B" : "A";
    assert.equal(verifyOAuthStateSignature(`${payload}.${flipped}`), false);
    assert.equal(verifyOAuthStateSignature("malformed"), false);
  });

  it("uses the first configured client origin", () => {
    process.env.CLIENT_URL = "http://localhost:3000, http://localhost:3001";
    assert.equal(getPrimaryClientUrl(), "http://localhost:3000");
  });
});
