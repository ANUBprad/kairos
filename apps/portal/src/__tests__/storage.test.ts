import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CloudinaryStorageProvider } from "@/lib/storage";

// Signed delivery is exercised against the real HMAC signer from the installed
// cloudinary SDK; only the secret is faked. No network is involved.
function withCloudinaryConfig(run: (provider: CloudinaryStorageProvider) => void | Promise<void>): Promise<void> {
  const previous = [
    ["CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME],
    ["CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET],
  ] as const;
  process.env.CLOUDINARY_CLOUD_NAME = "kairostest";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  try {
    return Promise.resolve(run(new CloudinaryStorageProvider()));
  } finally {
    for (const name of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_SECRET"]) {
      const entry = previous.find(([n]) => n === name);
      if (!entry) continue;
      if (entry[1] === undefined) delete process.env[name];
      else process.env[name] = entry[1];
    }
  }
}

describe("cloudinary storage provider — podcast media", () => {
  it("produces a short-lived signed authenticated delivery URL, never a public one", async () => {
    await withCloudinaryConfig(async (provider) => {
      const url = await provider.getSignedUrl("artifacts/podcast-abc");
      assert.match(url, /^https:\/\/res\.cloudinary\.com\/kairostest\/raw\/authenticated\/artifacts\/podcast-abc\?/);
      assert.doesNotMatch(url, /\/upload\//);
      const query = new URL(url).searchParams;
      assert.ok(query.get("expires_at"));
      assert.ok(query.get("timestamp"));
      assert.ok(query.get("signature"));
      const expiresAt = Number(query.get("expires_at"));
      const timestamp = Number(query.get("timestamp"));
      assert.ok(expiresAt > timestamp);
      assert.ok(expiresAt - timestamp <= 86_400 + 60); // ~24h window
    });
  });

  it("fails loudly when the signing secret is missing", async () => {
    const previous = process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_API_SECRET;
    try {
      const provider = new CloudinaryStorageProvider();
      await assert.rejects(provider.getSignedUrl("artifacts/podcast-abc"), /CLOUDINARY_API_SECRET is not configured/);
    } finally {
      if (previous === undefined) delete process.env.CLOUDINARY_API_SECRET;
      else process.env.CLOUDINARY_API_SECRET = previous;
    }
  });

  it("defaults uploads to public access and honours an authenticated option", () => {
    const source = readFileSync(new URL("../lib/storage/cloudinary.ts", import.meta.url), "utf8");
    assert.match(source, /options\?\.accessMode \?\? "public"/);
    assert.match(source, /access_mode: accessMode/);
  });
});