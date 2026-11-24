import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "X-Request-Id";
const MAX_REQUEST_ID_LENGTH = 128;
/** Accept only compact identifiers, never headers carrying control characters. */
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

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
    const supplied = req.header(REQUEST_ID_HEADER);
    const id =
        supplied && supplied.length <= MAX_REQUEST_ID_LENGTH &&
        VALID_REQUEST_ID.test(supplied)
            ? supplied
            : randomUUID();
    req.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
}
