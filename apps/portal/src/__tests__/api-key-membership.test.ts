import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const client = {
  apiKey: { findMany: async () => [], update: async () => ({}) },
  member: { findUnique: async (_args: unknown) => null },
};
(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient;

describe("API key membership revocation", () => {
  afterEach(() => mock.restoreAll());

  for (const member of [true, false]) {
    it(member ? "accepts a current member" : "rejects a removed member before updating usage", async () => {
      const { generateApiKey, validateAndRetrieveApiKey } = await import("@/lib/api-keys");
      const { key, keyHash, keyPrefix } = generateApiKey();
      mock.method(client.apiKey, "findMany", async () => [{
        id: "key", keyHash, keyPrefix, userId: "user", organizationId: "org",
        scopes: ["read"], expiresAt: null,
      }]);
      const membership = mock.method(client.member, "findUnique", async () => member ? { id: "member" } : null);
      const usage = mock.method(client.apiKey, "update", async () => ({}));

      const result = await validateAndRetrieveApiKey(key);
      assert.equal(result?.organizationId ?? null, member ? "org" : null);
      assert.deepEqual(membership.mock.calls[0]?.arguments[0], {
        where: { organizationId_userId: { organizationId: "org", userId: "user" } },
        select: { id: true },
      });
      assert.equal(usage.mock.callCount(), member ? 1 : 0);
    });
  }
});
