import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

/**
 * The shared provider fetch helper must always bound outbound calls. These
 * tests stub global fetch; no provider is contacted.
 */
describe("providerFetch", () => {
    const originalFetch = globalThis.fetch;

    after(() => {
        globalThis.fetch = originalFetch;
    });

    it("adds a default timeout signal when the caller provides none", async () => {
        let received: RequestInit | undefined;
        globalThis.fetch = (async (
            _input: Parameters<typeof fetch>[0],
            init?: RequestInit,
        ) => {
            received = init;
            return new Response("ok", { status: 200 });
        }) as typeof fetch;

        const { providerFetch, PROVIDER_TIMEOUT_MS } = await import("./provider-http.js");
        const response = await providerFetch("https://example.test/resource", {
            method: "POST",
        });
        assert.equal(response.status, 200);
        assert.equal(received?.method, "POST");
        assert.ok(received?.signal);
        // AbortSignal.timeout() produces a non-aborted signal with a reason.
        assert.equal((received?.signal as AbortSignal).aborted, false);
        assert.ok(PROVIDER_TIMEOUT_MS > 0);
    });

    it("combines a caller signal with the hard provider timeout", async () => {
        let received: RequestInit | undefined;
        globalThis.fetch = (async (
            _input: Parameters<typeof fetch>[0],
            init?: RequestInit,
        ) => {
            received = init;
            return new Response("ok", { status: 200 });
        }) as typeof fetch;

        const { providerFetch } = await import("./provider-http.js");
        const controller = new AbortController();
        await providerFetch("https://example.test/resource", {
            signal: controller.signal,
        });
        const combined = received?.signal as AbortSignal;
        assert.ok(combined);
        assert.notEqual(combined, controller.signal, "must not drop the timeout signal");
        assert.equal(combined.aborted, false);
        controller.abort("caller cancelled");
        assert.equal(combined.aborted, true, "caller cancellation must still propagate");
    });
});
