import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getOAuthCallbackUrl,
  OAUTH_CALLBACK_PATHS,
} from "./oauth-callback.js";

const managedKeys = [
  "SERVER_URL",
  "BETTER_AUTH_URL",
  "GOOGLE_REDIRECT_URI",
  "GITHUB_REDIRECT_URI",
  "NOTION_REDIRECT_URI",
] as const;
const originalEnv = new Map<string, string | undefined>();

describe("OAuth callback resolution", () => {
  beforeEach(() => {
    for (const key of managedKeys) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
  });

  it("uses localhost callbacks that match the integration routes", () => {
    assert.equal(
      OAUTH_CALLBACK_PATHS.googleDrive,
      "/api/integrations/google-drive/callback",
    );
    assert.equal(
      OAUTH_CALLBACK_PATHS.github,
      "/api/integrations/github/callback",
    );
    assert.equal(
      OAUTH_CALLBACK_PATHS.notion,
      "/api/integrations/notion/callback",
    );

    assert.equal(
      getOAuthCallbackUrl(undefined, OAUTH_CALLBACK_PATHS.googleDrive),
      "http://localhost:8081/api/integrations/google-drive/callback",
    );
    assert.equal(
      getOAuthCallbackUrl(undefined, OAUTH_CALLBACK_PATHS.github),
      "http://localhost:8081/api/integrations/github/callback",
    );
    assert.equal(
      getOAuthCallbackUrl(undefined, OAUTH_CALLBACK_PATHS.notion),
      "http://localhost:8081/api/integrations/notion/callback",
    );
  });

  it("derives omitted callbacks from SERVER_URL or BETTER_AUTH_URL", () => {
    process.env.SERVER_URL = "https://api.example.test/";
    assert.equal(
      getOAuthCallbackUrl(undefined, OAUTH_CALLBACK_PATHS.github),
      "https://api.example.test/api/integrations/github/callback",
    );

    delete process.env.SERVER_URL;
    process.env.BETTER_AUTH_URL = "https://auth.example.test";
    assert.equal(
      getOAuthCallbackUrl(undefined, OAUTH_CALLBACK_PATHS.notion),
      "https://auth.example.test/api/integrations/notion/callback",
    );
  });

  it("prefers an explicitly registered provider callback", () => {
    process.env.SERVER_URL = "https://api.example.test";
    assert.equal(
      getOAuthCallbackUrl(
        "https://provider.example.test/oauth/callback",
        OAUTH_CALLBACK_PATHS.googleDrive,
      ),
      "https://provider.example.test/oauth/callback",
    );
  });
});
