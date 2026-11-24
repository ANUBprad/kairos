import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import {
    normalizeRequestId,
    runWithRequestId,
} from "../lib/observability/request-context.js";

export const REQUEST_ID_HEADER = "X-Request-Id";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}

/**
 * Early, dependency-free correlation middleware. Every response receives a
 * stable request id; trusted clients may supply one for end-to-end tracing.
 */
export function requestIdMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const id = normalizeRequestId(req.header(REQUEST_ID_HEADER)) ?? randomUUID();
    req.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    // Downstream handlers, Inngest sends and worker/local fallback jobs all
    // inherit the same id through AsyncLocalStorage.
    runWithRequestId(id, () => next());
}
