import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as serveLocalStorage } from "@/app/api/storage/local/route";
import { LocalStorageProvider, verifyLocalStorageSignature } from "@/lib/storage/local";

describe("local development storage", () => {
  it("stores, signs, reads, and deletes private objects", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "kairos-local-storage-"));
    const previousRoot = process.env.KAIROS_LOCAL_STORAGE_DIR;
    const previousSecret = process.env.BETTER_AUTH_SECRET;
    const previousBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
    process.env.KAIROS_LOCAL_STORAGE_DIR = root;
    process.env.BETTER_AUTH_SECRET = "test-secret-for-local-storage";
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "http://localhost:3000";

    try {
      const storage = new LocalStorageProvider();
      const uploaded = await storage.upload(
        Buffer.from("private pdf bytes"),
        "notes.pdf",
        "kb-test/notes.pdf",
        { accessMode: "authenticated" },
      );

      assert.equal(uploaded.provider, "local");
      assert.equal(uploaded.key, "kb-test/notes.pdf");
      assert.equal((await readFile(path.join(root, "kb-test", "notes.pdf"))).toString(), "private pdf bytes");
      assert.equal((await storage.read(uploaded.key)).toString(), "private pdf bytes");

      const signedUrl = new URL(await storage.getSignedUrl(uploaded.key));
      const expires = Number(signedUrl.searchParams.get("expires"));
      const signature = signedUrl.searchParams.get("signature") || "";
      assert.equal(signedUrl.pathname, "/api/storage/local");
      assert.equal(signedUrl.searchParams.get("key"), uploaded.key);
      assert.equal(verifyLocalStorageSignature(uploaded.key, expires, signature), true);
      assert.equal(verifyLocalStorageSignature("../secrets", expires, signature), false);

      const served = await serveLocalStorage(new NextRequest(signedUrl));
      assert.equal(served.status, 200);
      assert.equal(await served.text(), "private pdf bytes");

      const rangeRequest = new NextRequest(signedUrl, { headers: { Range: "bytes=0-6" } });
      const partial = await serveLocalStorage(rangeRequest);
      assert.equal(partial.status, 206);
      assert.equal(await partial.text(), "private");

      const expiredUrl = new URL(signedUrl);
      expiredUrl.searchParams.set("expires", String(Math.floor(Date.now() / 1000) - 1));
      const expired = await serveLocalStorage(new NextRequest(expiredUrl));
      assert.equal(expired.status, 401);

      await storage.delete(uploaded.key);
      await assert.rejects(storage.read(uploaded.key));
    } finally {
      await rm(root, { recursive: true, force: true });
      if (previousRoot === undefined) delete process.env.KAIROS_LOCAL_STORAGE_DIR;
      else process.env.KAIROS_LOCAL_STORAGE_DIR = previousRoot;
      if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
      else process.env.BETTER_AUTH_SECRET = previousSecret;
      if (previousBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
      else process.env.NEXT_PUBLIC_BETTER_AUTH_URL = previousBaseUrl;
    }
  });
});
