import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafePublicHttpUrl } from "./safe-fetch.js";

describe("safe outbound fetch", () => {
  it("rejects non-http schemes, embedded credentials, and odd ports", async () => {
    await assert.rejects(
      assertSafePublicHttpUrl("file:///etc/passwd"),
      /Only http and https/,
    );
    await assert.rejects(
      assertSafePublicHttpUrl("https://user:pass@example.com/"),
      /embedded credentials/,
    );
    await assert.rejects(
      assertSafePublicHttpUrl("http://example.com:8080/"),
      /port is not allowed/,
    );
  });

  it("rejects loopback and private addresses without resolving them", async () => {
    await assert.rejects(
      assertSafePublicHttpUrl("http://localhost/"),
      /host is not permitted/,
    );
    await assert.rejects(
      assertSafePublicHttpUrl("http://127.0.0.1/"),
      /permitted public address/,
    );
    await assert.rejects(
      assertSafePublicHttpUrl("http://[::1]/"),
      /permitted public address/,
    );
    await assert.rejects(
      assertSafePublicHttpUrl("http://192.168.1.10/"),
      /permitted public address/,
    );
  });
});
