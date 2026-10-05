import { it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

let scopes = ["read"];
let role = "OWNER";
let keyHash = "";
const client = {
  apiKey: {
    findMany: async () => [{ id: "key", keyHash, userId: "user", organizationId: "org", scopes, expiresAt: null }],
    update: async () => ({}),
  },
  member: { findUnique: async () => ({ id: "member", role }) },
};
(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient;

it("API requests require both key scope and the current member role", async () => {
  const { generateApiKey } = await import("@/lib/api-keys");
  const { validateApiKey } = await import("@/lib/server/api-auth");
  const generated = generateApiKey();
  keyHash = generated.keyHash;
  for (const [keyScopes, memberRole, method, resource, allowed] of [
    [["read"], "OWNER", "GET", "experiments", true],
    [["read"], "OWNER", "POST", "experiments", false],
    [["write"], "MEMBER", "POST", "experiments", true],
    [["write"], "VIEWER", "POST", "experiments", false],
    [["admin"], "MEMBER", "DELETE", "experiments/id", false],
    [["admin"], "ADMIN", "DELETE", "experiments/id", true],
    [["experiment"], "MEMBER", "POST", "experiments", true],
    [["experiment"], "MEMBER", "POST", "artifacts", false],
    [["artifacts"], "MEMBER", "POST", "artifacts", true],
    [[], "OWNER", "GET", "experiments", false],
    [["read"], "VIEWER", "POST", "compare", true],
  ] as const) {
    scopes = [...keyScopes];
    role = memberRole;
    const request = new NextRequest(`http://localhost/api/v1/${resource}`, {
      method, headers: { "x-api-key": generated.key },
    });
    assert.equal(Boolean(await validateApiKey(request)), allowed, `${keyScopes}/${memberRole}/${method}/${resource}`);
  }
});
