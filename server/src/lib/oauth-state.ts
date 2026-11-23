import crypto from "crypto";
import type { Request, Response } from "express";
import prisma from "./db.js";
import { timingSafeEqualString } from "./crypto.js";
import { AppError, ValidationError } from "../types/app-error.js";
import type { IntegrationProvider } from "../generated/prisma/client.js";

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_VERSION = 1;

type StatePayload = {
    v: number;
    uid: string;
    p: IntegrationProvider;
    n: string;
    exp: number;
    r: string | null;
};

export interface IssuedOAuthState {
    token: string;
    nonce: string;
    expiresAt: Date;
}

function getStateSecret(): string {
    const secret =
        process.env.OAUTH_STATE_SECRET?.trim() ||
        process.env.BETTER_AUTH_SECRET?.trim();
    if (!secret || secret.length < 32) {
        throw new AppError(
            500,
            "A state secret of at least 32 characters is required for OAuth state signing",
        );
    }
    return secret;
}

function isProduction(): boolean {
    return (
        process.env.NODE_ENV === "production" ||
        process.env.BETTER_AUTH_URL?.startsWith("https://") === true
    );
}

function sign(encodedPayload: string): string {
    return crypto
        .createHmac("sha256", getStateSecret())
        .update(encodedPayload)
        .digest("base64url");
}

/** Accepts only same-origin relative paths; rejects absolute and protocol-relative URLs. */
export function validateReturnPath(input: unknown): string {
    if (input === undefined || input === null || input === "") {
        return "/settings/integrations";
    }
    if (typeof input !== "string") {
        throw new ValidationError("Invalid return path");
    }
    if (
        input.length > 512 ||
        !input.startsWith("/") ||
        input.startsWith("//") ||
        input.includes("\\") ||
        /[\u0000-\u001F\u007F]/.test(input)
    ) {
        throw new ValidationError("Invalid return path");
    }

    const probe = new URL(input, "http://kairos.invalid");
    if (
        probe.origin !== "http://kairos.invalid" ||
        probe.username ||
        probe.password ||
        probe.protocol !== "http:"
    ) {
        throw new ValidationError("Invalid return path");
    }

    return `${probe.pathname}${probe.search}${probe.hash}`;
}

/** First configured client origin. CLIENT_URL may contain a comma-separated list. */
export function getPrimaryClientUrl(): string {
    const configured =
        process.env.CLIENT_URL?.split(",")
            .map((value) => value.trim().replace(/\/$/, ""))
            .find(Boolean) || "http://localhost:3000";
    return validateConfiguredOrigin(configured);
}

function validateConfiguredOrigin(value: string): string {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new AppError(500, "CLIENT_URL is not a valid absolute URL");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new AppError(500, "CLIENT_URL must use http or https");
    }
    if (isProduction() && parsed.protocol !== "https:") {
        throw new AppError(500, "CLIENT_URL must use https in production");
    }
    return parsed.origin;
}

function cookieName(provider: IntegrationProvider): string {
    return `oauth_state_${provider.toLowerCase()}`;
}

function parseCookieHeader(header: string | undefined): Map<string, string> {
    const result = new Map<string, string>();
    if (!header) return result;
    for (const part of header.split(";")) {
        const separator = part.indexOf("=");
        if (separator === -1) continue;
        const name = part.slice(0, separator).trim();
        const rawValue = part.slice(separator + 1).trim();
        try {
            result.set(name, decodeURIComponent(rawValue));
        } catch {
            result.set(name, rawValue);
        }
    }
    return result;
}

export function readOAuthStateCookie(
    req: Request,
    provider: IntegrationProvider,
): string | undefined {
    return parseCookieHeader(req.headers.cookie).get(cookieName(provider));
}

export function setOAuthStateCookie(
    res: Response,
    provider: IntegrationProvider,
    nonce: string,
): void {
    res.cookie(cookieName(provider), nonce, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction(),
        path: "/api/integrations",
        maxAge: STATE_TTL_MS,
    });
}

export function clearOAuthStateCookie(
    res: Response,
    provider: IntegrationProvider,
): void {
    res.clearCookie(cookieName(provider), {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction(),
        path: "/api/integrations",
    });
}

/**
 * Creates a signed, provider/user/expiry-bound state token and stores its nonce
 * for single-use verification in the database.
 */
export async function issueOAuthState(input: {
    userId: string;
    provider: IntegrationProvider;
    returnTo?: unknown;
}): Promise<IssuedOAuthState> {
    const nonce = crypto.randomBytes(32).toString("base64url");
    const returnTo = input.returnTo === undefined ? null : validateReturnPath(input.returnTo);
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);
    const payload: StatePayload = {
        v: STATE_VERSION,
        uid: input.userId,
        p: input.provider,
        n: nonce,
        exp: expiresAt.getTime(),
        r: returnTo,
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const token = `${encodedPayload}.${sign(encodedPayload)}`;

    await prisma.oAuthStateNonce.create({
        data: {
            nonce,
            userId: input.userId,
            provider: input.provider,
            returnTo,
            expiresAt,
        },
    });

    return { token, nonce, expiresAt };
}

export interface VerifiedOAuthState {
    userId: string;
    provider: IntegrationProvider;
    returnTo: string | null;
}

/** Verifies signature, cookie binding, expiry, provider, and single-use nonce. */
export async function verifyOAuthState(input: {
    token: unknown;
    cookieNonce: string | undefined;
    provider: IntegrationProvider;
}): Promise<VerifiedOAuthState> {
    if (typeof input.token !== "string" || !input.cookieNonce) {
        throw new ValidationError("Missing OAuth state or state cookie");
    }

    const parts = input.token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new ValidationError("Malformed OAuth state");
    }

    const expectedSignature = sign(parts[0]);
    if (!timingSafeEqualString(expectedSignature, parts[1])) {
        throw new ValidationError("Invalid OAuth state signature");
    }

    let payload: StatePayload;
    try {
        payload = JSON.parse(
            Buffer.from(parts[0], "base64url").toString("utf8"),
        ) as StatePayload;
    } catch {
        throw new ValidationError("Malformed OAuth state");
    }

    if (
        payload.v !== STATE_VERSION ||
        typeof payload.uid !== "string" ||
        payload.p !== input.provider ||
        typeof payload.n !== "string" ||
        typeof payload.exp !== "number" ||
        payload.exp <= Date.now()
    ) {
        throw new ValidationError("Expired or invalid OAuth state");
    }

    if (!timingSafeEqualString(payload.n, input.cookieNonce)) {
        throw new ValidationError("OAuth state cookie mismatch");
    }

    const record = await prisma.oAuthStateNonce.findUnique({
        where: { nonce: payload.n },
    });
    if (
        !record ||
        record.userId !== payload.uid ||
        record.provider !== input.provider ||
        record.returnTo !== payload.r ||
        record.expiresAt.getTime() !== payload.exp ||
        record.consumedAt
    ) {
        throw new ValidationError("OAuth state has already been used or is invalid");
    }

    const consumed = await prisma.oAuthStateNonce.updateMany({
        where: {
            id: record.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
        throw new ValidationError("OAuth state has already been used");
    }

    return {
        userId: record.userId,
        provider: record.provider,
        returnTo: record.returnTo,
    };
}

/** Exported for tests that need to reproduce signature checks without a DB. */
export function verifyOAuthStateSignature(token: string): boolean {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    return timingSafeEqualString(sign(parts[0]), parts[1]);
}
