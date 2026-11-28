#!/usr/bin/env node
/** Regression guard for provider-safe OAuth error messages. */
import assert from "node:assert/strict";
import {
  authErrorFromQuery,
  friendlyAuthError,
  oauthCallbackError,
} from "../client/features/auth/lib/auth-error.ts";

const denied = oauthCallbackError("access_denied", "github");
assert.equal(denied, "GitHub sign-in was cancelled or denied. Please try again.");
assert.equal(
  oauthCallbackError("redirect_uri_mismatch", "google"),
  "Google sign-in is not configured correctly. Check the registered callback URL.",
);
assert.match(
  oauthCallbackError("unable_to_get_user_info", "google"),
  /could not read your Google account details/,
);
assert.match(oauthCallbackError("not_a_real_code", "github"), /couldn't complete GitHub sign-in/);
assert.equal(oauthCallbackError("", "google"), null);

const query = new URLSearchParams(
  "auth_provider=github&error=access_denied&error_description=https%3A%2F%2Fsecret.example%2Faccount",
);
const fromQuery = authErrorFromQuery(query);
assert.match(fromQuery, /GitHub sign-in was cancelled/);
assert.doesNotMatch(fromQuery, /secret\.example|error_description/i);

assert.match(friendlyAuthError(new Error("Google client id is not configured"), "google"), /not configured correctly/);
assert.match(friendlyAuthError({ code: "STATE_NOT_FOUND" }, "github"), /session expired/i);
assert.match(friendlyAuthError(new Error("fetch failed"), "github"), /couldn't reach GitHub/);
assert.doesNotMatch(
  friendlyAuthError(new Error("internal token sk-abcdefghijklmnop"), "google"),
  /sk-abcdefghijklmnop/,
);

console.log("AUTH ERROR GUARD: PASS (11 cases)");
