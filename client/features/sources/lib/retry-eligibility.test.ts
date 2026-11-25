import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canRetrySource, isSourceRefunded } from "./retry-eligibility.js";

describe("source retry eligibility", () => {
    const base = {
        status: "FAILED" as const,
        metadata: {},
        refunded: false,
        canReprocess: true,
    };

    it("offers Retry for an ordinary failed source", () => {
        assert.equal(canRetrySource(base), true);
    });

    it("hides Retry for a refunded source from the ledger", () => {
        const refunded = { ...base, refunded: true, canReprocess: false };
        assert.equal(isSourceRefunded(refunded), true);
        assert.equal(canRetrySource(refunded), false);
    });

    it("hides Retry for legacy refund metadata even without the new flags", () => {
        const legacy = {
            status: "FAILED" as const,
            metadata: { refundedAt: "2026-11-25T00:00:00.000Z" },
        };
        assert.equal(isSourceRefunded(legacy), true);
        assert.equal(canRetrySource(legacy), false);
    });

    it("never offers Retry for a ready source", () => {
        assert.equal(canRetrySource({ ...base, status: "READY" }), false);
    });
});
