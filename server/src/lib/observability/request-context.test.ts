import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    getRequestId,
    normalizeRequestId,
    runWithRequestId,
} from "./request-context.js";

describe("request correlation context", () => {
    it("validates only compact, log-safe ids", () => {
        assert.equal(normalizeRequestId("trace-abc12345"), "trace-abc12345");
        assert.equal(normalizeRequestId("bad\nheader"), undefined);
        assert.equal(normalizeRequestId("x".repeat(129)), undefined);
        assert.equal(normalizeRequestId("short"), undefined);
        assert.equal(normalizeRequestId(12345), undefined);
    });

    it("propagates through async work and restores the previous context", async () => {
        assert.equal(getRequestId(), undefined);

        await runWithRequestId("trace-parent123", async () => {
            assert.equal(getRequestId(), "trace-parent123");
            await Promise.resolve();
            assert.equal(getRequestId(), "trace-parent123");
            await runWithRequestId("trace-child1234", async () => {
                assert.equal(getRequestId(), "trace-child1234");
            });
            assert.equal(getRequestId(), "trace-parent123");
        });

        assert.equal(getRequestId(), undefined);
    });

    it("ignores invalid ids instead of creating an unsafe context", () => {
        let observed = "unset";
        runWithRequestId("bad\nheader", () => {
            observed = getRequestId() ?? "none";
        });
        assert.equal(observed, "none");
    });
});
