import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getAllowedOrigins } from "../config/network.js";

export const CSRF_FAILURE_MESSAGE = "CSRF origin check failed";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Routes that own their own cross-request protections:
 * - /api/auth is handled by Better Auth's origin checking.
 * - /api/payment/webhook uses a raw body plus Razorpay HMAC verification.
 * - /api/inngest authenticates via its signing key.
 */
export const DEFAULT_CSRF_EXEMPT_PATHS = [
    "/api/auth",
    "/api/payment/webhook",
    "/api/inngest",
] as const;

export interface CsrfProtectionOptions {
    /** Override the configured client origins (primarily for tests). */
    allowedOrigins?: readonly string[];
    /** Override the paths that skip CSRF checks. Prefix matches are path-segment aware. */
    exemptPaths?: readonly string[];
}

function firstHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

function normalizeOrigin(value: string): string | undefined {
    try {
        const parsed = new URL(value.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return undefined;
        }
        return parsed.origin;
    } catch {
        return undefined;
    }
}

function requestPath(req: Request): string {
    const raw = req.originalUrl || req.path || req.url || "";
    const path = raw.split("?")[0] || "/";
    return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function isExemptPath(path: string, exemptPaths: readonly string[]): boolean {
    return exemptPaths.some((rawPrefix) => {
        const prefix = rawPrefix.replace(/\/+$/, "") || "/";
        return path === prefix || path.startsWith(`${prefix}/`);
    });
}

/**
 * Explicit CSRF/origin protection for custom state-changing API routes.
 *
 * Safe defaults:
 * - Only POST/PUT/PATCH/DELETE under /api are checked; reads and non-API routes pass.
 * - `Sec-Fetch-Site: cross-site` is always rejected; `same-origin`/`none` pass.
 * - Otherwise an Origin header must be present and exactly match a configured
 *   allowed origin. Missing Origin is rejected rather than silently trusted:
 *   non-browser clients must target an exempt route (or a browser must send Origin).
 * - Better Auth, the HMAC Razorpay webhook, and Inngest are exempt by path.
 *
 * Exempting additional paths weakens CSRF protection and should be deliberate.
 */
export function createCsrfProtection(
    options: CsrfProtectionOptions = {},
): RequestHandler {
    const exemptPaths = options.exemptPaths ?? DEFAULT_CSRF_EXEMPT_PATHS;

    return function csrfProtection(
        req: Request,
        res: Response,
        next: NextFunction,
    ): void {
        if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
            next();
            return;
        }

        const path = requestPath(req);
        if (!path.startsWith("/api/") && path !== "/api") {
            next();
            return;
        }
        if (isExemptPath(path, exemptPaths)) {
            next();
            return;
        }

        const reject = (): void => {
            res.status(403).json({ error: CSRF_FAILURE_MESSAGE });
        };

        const fetchSite = firstHeader(req.headers["sec-fetch-site"])?.toLowerCase();
        if (fetchSite === "cross-site") {
            reject();
            return;
        }
        if (fetchSite === "same-origin" || fetchSite === "none") {
            next();
            return;
        }

        const rawOrigin = firstHeader(req.headers.origin);
        if (!rawOrigin || rawOrigin.includes(",")) {
            reject();
            return;
        }

        const origin = normalizeOrigin(rawOrigin);
        if (!origin) {
            reject();
            return;
        }

        const allowed = options.allowedOrigins ?? getAllowedOrigins();
        const allowedSet = new Set(
            allowed
                .map(normalizeOrigin)
                .filter((value): value is string => value !== undefined),
        );
        if (!allowedSet.has(origin)) {
            reject();
            return;
        }

        next();
    };
}

export const csrfProtection = createCsrfProtection();
