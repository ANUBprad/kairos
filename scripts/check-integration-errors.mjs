#!/usr/bin/env node
/** Regression guard for provider-safe integration callback errors. */
import assert from "node:assert/strict";
import { integrationErrorFromQuery } from "../client/features/integrations/lib/integration-callback.ts";

const denied = integrationErrorFromQuery(
  new URLSearchParams("google_drive_error=access_denied"),
);
assert.equal(denied?.provider, "googleDrive");
assert.match(denied?.message ?? "", /Google Drive authorization was cancelled/);

const github = integrationErrorFromQuery(
  new URLSearchParams("github_error=invalid_scope"),
);
assert.match(github?.message ?? "", /GitHub needs the requested access/);

const state = integrationErrorFromQuery(
  new URLSearchParams("github_error=oauth_state_invalid"),
);
assert.match(state?.message ?? "", /session expired/);

const injected = integrationErrorFromQuery(
  new URLSearchParams(
    "google_drive_error=https%3A%2F%2Fevil.example%2Ftoken%3Ferror%3Dsecret",
  ),
);
assert.equal(injected, null);

const legacy = integrationErrorFromQuery(
  new URLSearchParams("error=oauth_invalid_state"),
);
assert.match(legacy?.message ?? "", /session expired/);

assert.equal(integrationErrorFromQuery(new URLSearchParams("connected=github")), null);

console.log("INTEGRATION ERROR GUARD: PASS (7 cases)");
