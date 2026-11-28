import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { providerCallbackCode } from "./integration.controller.js";

describe("integration OAuth callback codes", () => {
    it("maps cancelled consent to a fixed safe code", () => {
        assert.equal(providerCallbackCode("access_denied"), "access_denied");
        assert.equal(providerCallbackCode("user_denied"), "access_denied");
        assert.equal(providerCallbackCode("cancelled"), "access_denied");
    });

    it("maps missing scopes without reflecting provider text", () => {
        assert.equal(providerCallbackCode("invalid_scope"), "invalid_scope");
    });

    it("rejects malformed codes and collapses unknown codes", () => {
        assert.equal(providerCallbackCode(undefined), null);
        assert.equal(providerCallbackCode("bad code with spaces"), null);
        assert.equal(providerCallbackCode("server_error"), "oauth_failed");
    });
});
