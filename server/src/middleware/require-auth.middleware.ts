import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import type { Session } from "../lib/session.js";

declare module "express-serve-static-core" {
    interface Request {
        session: Session;
    }
}


/**
 * Express middleware that validates the Better-Auth session cookie or authorization header.
 * Attaches the authenticated session and user object to `req.session`.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next middleware function
 * @returns 401 Unauthorized if session is invalid or user is not logged in
 */
export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const session =
        req.session ??
        (await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        }));

    if (!session?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    req.session = session;
    next();
}

/** Resolves a session when present without rejecting unauthenticated requests. */
export async function optionalAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    if (!req.session) {
        try {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(req.headers),
            });
            if (session?.user) req.session = session;
        } catch {
            // Rate limiting can fall back to IP when session resolution fails.
        }
    }
    next();
}