import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrollBehavior } from "./scroll.js";

describe("scroll behavior preference", () => {
    it("uses instant scrolling when reduced motion is requested", () => {
        assert.equal(scrollBehavior(true), "auto");
    });

    it("uses smooth scrolling otherwise", () => {
        assert.equal(scrollBehavior(false), "smooth");
        assert.equal(scrollBehavior(null), "smooth");
        assert.equal(scrollBehavior(undefined), "smooth");
    });
});
