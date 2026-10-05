import { describe, it, mock } from "node:test";
import { Writable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CloudinaryStorageProvider } from "@/lib/storage";

// Signed delivery is exercised against the real HMAC signer from the installed
// cloudinary SDK; only the secret is faked. No network is involved.
async function withCloudinaryConfig(run: (provider: CloudinaryStorageProvider) => void | Promise<void>): Promise<void> {
  const previous = [
    ["CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME],
    ["CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY],
    ["CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET],
  ] as const;
  process.env.CLOUDINARY_CLOUD_NAME = "kairostest";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  try {
    await run(new CloudinaryStorageProvider());
  } finally {
    for (const name of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
      const entry = previous.find(([n]) => n === name);
      if (!entry) continue;
      if (entry[1] === undefined) delete process.env[name];
      else process.env[name] = entry[1];
    }
  }
}

describe("cloudinary storage provider — podcast media", () => {
  it("persists the delivery type in new keys and uses it for deletion", async () => {
    const upload = mock.method(cloudinary.uploader, "upload_stream", (
      options: { type: string },
      callback: (error: undefined, result: { public_id: string; secure_url: string }) => void,
    ) => new Writable({
      write(_chunk, _encoding, done) { done(); },
      final(done) {
        assert.equal(options.type, "authenticated");
        callback(undefined, { public_id: "asset", secure_url: "https://example.com/asset" });
        done();
      },
    }));
    const destroy = mock.method(cloudinary.uploader, "destroy", async () => ({}));
    try {
      const provider = new CloudinaryStorageProvider();
      const file = await provider.upload(Buffer.from("test"), "test.txt", "asset", { accessMode: "authenticated" });
      assert.equal(file.key, "authenticated:asset");
      await provider.delete(file.key);
      assert.deepEqual(destroy.mock.calls[0].arguments, ["asset", { resource_type: "raw", type: "authenticated" }]);
      await provider.delete("legacy");
      assert.deepEqual(destroy.mock.calls[1].arguments, ["legacy", { resource_type: "raw", type: "upload" }]);
    } finally {
      upload.mock.restore();
      destroy.mock.restore();
    }
  });

  it("produces a short-lived signed authenticated delivery URL, never a public one", async () => {
    await withCloudinaryConfig(async (provider) => {
      const url = await provider.getSignedUrl("authenticated:artifacts/podcast-abc");
      assert.match(url, /^https:\/\/api\.cloudinary\.com\/v1_1\/kairostest\/raw\/download\?/);
      assert.doesNotMatch(url, /\/upload\//);
      const query = new URL(url).searchParams;
      assert.equal(query.get("public_id"), "artifacts/podcast-abc");
      assert.equal(query.get("type"), "authenticated");
      assert.equal(query.get("api_key"), "test-key");
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
      await assert.rejects(provider.getSignedUrl("authenticated:artifacts/podcast-abc"), /CLOUDINARY_API_SECRET is not configured/);
    } finally {
      if (previous === undefined) delete process.env.CLOUDINARY_API_SECRET;
      else process.env.CLOUDINARY_API_SECRET = previous;
    }
  });

  it("defaults uploads to public access and honours an authenticated option", () => {
    const source = readFileSync(new URL("../lib/storage/cloudinary.ts", import.meta.url), "utf8");
    assert.match(source, /options\?\.accessMode \?\? "public"/);
    assert.match(source, /type: accessMode === "authenticated" \? "authenticated" : "upload"/);
    assert.doesNotMatch(source, /access_mode:/);
  });
});
