import { it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

it("production rejects the development shared secret", async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, KAIROS_API_SECRET: process.env.KAIROS_API_SECRET };
  try {
    Object.assign(process.env, { NODE_ENV: "production", KAIROS_API_SECRET: "shared-development-secret" });
    const { validateApiKey } = await import("@/lib/server/api-auth");
    const request = new NextRequest("http://localhost/api/v1/experiments", {
      headers: { "x-api-key": "shared-development-secret" },
    });
    assert.equal(await validateApiKey(request), null);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
