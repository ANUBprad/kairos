import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasUsableIntegrationToken } from "./integration-status.js";

const NOW = Date.parse("2026-11-28T12:00:00.000Z");

describe("integration connection status", () => {
    it("treats a missing row as disconnected", () => {
        assert.equal(hasUsableIntegrationToken(null, NOW), false);
    });

    it("treats a non-expiring token as connected", () => {
        assert.equal(hasUsableIntegrationToken({ expiresAt: null }, NOW), true);
    });

    it("treats an unexpired token as connected", () => {
        assert.equal(
            hasUsableIntegrationToken(
                { expiresAt: new Date(NOW + 60_000), refreshToken: null },
                NOW,
            ),
            true,
        );
    });

    it("treats an expired token without refresh as needing reconnect", () => {
        assert.equal(
            hasUsableIntegrationToken(
                { expiresAt: new Date(NOW - 60_000), refreshToken: null },
                NOW,
            ),
            false,
        );
    });

    it("accepts a refreshable expired token and ignores blank refresh tokens", () => {
        assert.equal(
            hasUsableIntegrationToken(
                { expiresAt: new Date(NOW - 60_000), refreshToken: "refresh-token" },
                NOW,
            ),
            true,
        );
        assert.equal(
            hasUsableIntegrationToken(
                { expiresAt: new Date(NOW - 60_000), refreshToken: "   " },
                NOW,
            ),
            false,
        );
    });

    it("uses a skew window and accepts serialized timestamps", () => {
        assert.equal(
            hasUsableIntegrationToken({ expiresAt: new Date(NOW + 10_000) }, NOW),
            true,
        );
        assert.equal(
            hasUsableIntegrationToken({ expiresAt: "2026-11-28T11:59:00.000Z" }, NOW),
            false,
        );
    });
});
