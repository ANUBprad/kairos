import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toConnectedAccountDto } from "./integration.controller.js";

const SECRET_ACCESS_TOKEN = "secret_notion_access_token_value";
const SECRET_REFRESH_TOKEN = "secret_notion_refresh_token_value";

const fullAccount = {
    id: "account_1",
    userId: "user_1",
    provider: "NOTION" as const,
    accessToken: SECRET_ACCESS_TOKEN,
    refreshToken: SECRET_REFRESH_TOKEN,
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    metadata: { workspaceName: "Study space" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("connected account response DTO", () => {
    it("returns only public fields", () => {
        const dto = toConnectedAccountDto(fullAccount);
        assert.deepEqual(Object.keys(dto).sort(), [
            "createdAt",
            "id",
            "metadata",
            "provider",
            "updatedAt",
        ]);
    });

    it("never serializes provider tokens or the owner id", () => {
        const dto = toConnectedAccountDto(fullAccount);
        const serialized = JSON.stringify({ success: true, account: dto });

        assert.equal(serialized.includes(SECRET_ACCESS_TOKEN), false);
        assert.equal(serialized.includes(SECRET_REFRESH_TOKEN), false);
        assert.equal(serialized.includes("accessToken"), false);
        assert.equal(serialized.includes("refreshToken"), false);
        assert.equal(serialized.includes("userId"), false);
        assert.equal(serialized.includes("expiresAt"), false);
        assert.equal(
            JSON.stringify(dto),
            JSON.stringify({
                id: fullAccount.id,
                provider: fullAccount.provider,
                metadata: fullAccount.metadata,
                createdAt: fullAccount.createdAt,
                updatedAt: fullAccount.updatedAt,
            }),
        );
    });
});
