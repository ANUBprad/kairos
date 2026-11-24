import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { getRequestId } from "../lib/observability/request-context.js";
import {
    REQUEST_ID_HEADER,
    requestIdMiddleware,
} from "./request-id.middleware.js";

function invoke(supplied?: string) {
    const headers: Record<string, string> = {};
    const req = {
        header: (name: string) =>
            name.toLowerCase() === REQUEST_ID_HEADER.toLowerCase()
                ? supplied
                : undefined,
        requestId: undefined as string | undefined,
    } as unknown as Request;
    const res = {
        setHeader: (name: string, value: string) => {
            headers[name.toLowerCase()] = value;
        },
    } as unknown as Response;
    let called = 0;
    let contextDuringNext: string | undefined;
    const next = (() => {
        called += 1;
        contextDuringNext = getRequestId();
    }) as NextFunction;
    requestIdMiddleware(req, res, next);
    return { id: req.requestId, headers, called, contextDuringNext };
}

describe("request id middleware", () => {
    it("generates a unique id when none is supplied", () => {
        const first = invoke();
        const second = invoke();
        assert.match(first.id!, /^[0-9a-f-]{36}$/);
        assert.notEqual(first.id, second.id);
        assert.equal(first.headers[REQUEST_ID_HEADER.toLowerCase()], first.id);
        assert.equal(first.contextDuringNext, first.id);
        assert.equal(first.called, 1);
    });

    it("echoes a valid supplied id and rejects unsafe values", () => {
        assert.equal(invoke("trace-abc12345").id, "trace-abc12345");
        for (const bad of ["bad\nheader", "x".repeat(129), "//evil.example"]) {
            assert.notEqual(invoke(bad).id, bad);
        }
    });
});
