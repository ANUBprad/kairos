import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";

type Captured = { status: number; body: unknown };

function fakeResponse(): { res: Response; captured: Captured } {
    const captured: Captured = { status: 0, body: undefined };
    const res = {
        status(code: number) {
            captured.status = code;
            return this;
        },
        json(body: unknown) {
            captured.body = body;
            return this;
        },
    } as unknown as Response;
    return { res, captured };
}

const REQ = {} as Request;
const NEXT = (() => {}) as NextFunction;

describe("error handler hygiene", () => {
    const originalWarn = console.warn;
    const originalError = console.error;

    after(() => {
        console.warn = originalWarn;
        console.error = originalError;
    });

    it("returns a generic message for a Cloudinary 403 without dashboard guidance", async () => {
        const warnings: unknown[][] = [];
        console.warn = (...args: unknown[]) => { warnings.push(args); };

        const { errorHandler } = await import("./error-handler.middleware.js");
        const { res, captured } = fakeResponse();
        const error = Object.assign(new Error("upload rejected"), {
            name: "UnexpectedResponse",
            http_code: 403,
        });

        errorHandler(error, REQ, res, NEXT);

        assert.equal(captured.status, 400);
        assert.deepEqual(captured.body, { error: "Cloudinary rejected the upload." });
        assert.doesNotMatch(JSON.stringify(captured.body), /Dashboard|API Keys|permission|secret/i);
        assert.ok(warnings.length > 0, "operational detail should be logged server-side");
    });

    it("maps malformed multipart parser errors to 400 without parser details", async () => {
        console.error = () => {};
        const { errorHandler } = await import("./error-handler.middleware.js");
        const { res, captured } = fakeResponse();

        errorHandler(
            new Error("Multipart: Boundary not found in request body"),
            REQ,
            res,
            NEXT,
        );

        assert.equal(captured.status, 400);
        assert.deepEqual(captured.body, {
            error: "Malformed multipart upload",
        });
        assert.doesNotMatch(JSON.stringify(captured.body), /Boundary|not found/i);
    });

    it("returns a fixed 500 body for unknown errors", async () => {
        console.error = () => {};
        const { errorHandler } = await import("./error-handler.middleware.js");
        const { res, captured } = fakeResponse();

        errorHandler(new Error("db password hunter2 at postgresql://user:pw@host/db"), REQ, res, NEXT);

        assert.equal(captured.status, 500);
        assert.deepEqual(captured.body, { error: "Internal server error" });
    });
});
