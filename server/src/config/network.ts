import net from "node:net";
import { AppError } from "../types/app-error.js";

const LOCALHOST_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
];

const LOOPBACK_HOSTNAMES = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
]);

function isLoopbackHost(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
        LOOPBACK_HOSTNAMES.has(normalized) ||
        normalized.endsWith(".localhost") ||
        /^127\./.test(normalized)
    );
}

export function isProductionEnvironment(): boolean {
    return (
        process.env.DEPLOYMENT_ENV === "production" ||
        process.env.NODE_ENV === "production" ||
        process.env.BETTER_AUTH_URL?.startsWith("https://") === true
    );
}

function parseOrigin(value: string): string {
    if (value.includes("*")) {
        throw new AppError(500, "Wildcard origins are not allowed");
    }
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new AppError(500, "CLIENT_URL contains an invalid origin");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new AppError(500, "CLIENT_URL origins must use http or https");
    }
    if (isProductionEnvironment()) {
        if (parsed.protocol !== "https:") {
            throw new AppError(500, "CLIENT_URL must use https in production");
        }
        if (isLoopbackHost(parsed.hostname)) {
            throw new AppError(
                500,
                "Localhost origins are not allowed in production",
            );
        }
    }
    return parsed.origin;
}

/** Explicit, validated CORS origin list. Wildcards and production localhost are rejected. */
export function getAllowedOrigins(): string[] {
    const configured = (process.env.CLIENT_URL || "")
        .split(",")
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter(Boolean);

    if (configured.some((value) => value === "*")) {
        throw new AppError(500, "Wildcard CLIENT_URL is not allowed with credentials");
    }

    const origins = configured.map(parseOrigin);

    if (!isProductionEnvironment()) {
        for (const local of LOCALHOST_ORIGINS) {
            if (!origins.includes(local)) origins.push(local);
        }
    }

    if (origins.length === 0) {
        throw new AppError(500, "At least one CLIENT_URL origin must be configured");
    }

    // Defense in depth: never return a loopback origin to a production caller.
    if (
        isProductionEnvironment() &&
        origins.some((origin) => isLoopbackHost(new URL(origin).hostname))
    ) {
        throw new AppError(500, "Localhost origins are not allowed in production");
    }

    return origins;
}

function isIpOrCidr(token: string): boolean {
    const [address, prefix, ...extra] = token.split("/");
    if (extra.length > 0) return false;
    const family = net.isIP(address);
    if (family === 0) return false;
    if (prefix === undefined) return true;
    if (!/^\d+$/.test(prefix)) return false;
    const bits = Number(prefix);
    return bits >= 0 && bits <= (family === 4 ? 32 : 128);
}

function parseTrustedProxyTokens(): string[] {
    return (process.env.TRUST_PROXY || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

/**
 * Express trust-proxy setting. Nothing is trusted unless explicitly configured.
 *
 * Numeric hop counts are supported for local development only: Express treats a
 * number as a hop count, which Better Auth cannot express as a trusted proxy
 * address. Production therefore requires an explicit token list so both layers
 * enforce the same policy.
 */
export function getExpressTrustProxy(): false | number | string | string[] {
    const tokens = parseTrustedProxyTokens();
    if (tokens.length === 0) return false;
    if (tokens.some((token) => token.includes("*"))) {
        throw new AppError(500, "Wildcard TRUST_PROXY entries are not allowed");
    }
    for (const token of tokens) {
        // A lone integer is a hop count (development only) validated below.
        if (/^\d+$/.test(token)) continue;
        if (!isIpOrCidr(token)) {
            throw new AppError(500, `TRUST_PROXY entry "${token}" must be an IP address or CIDR`);
        }
    }
    if (tokens.length === 1 && /^\d+$/.test(tokens[0])) {
        const hops = Number(tokens[0]);
        if (!Number.isSafeInteger(hops) || hops < 1) {
            throw new AppError(500, "TRUST_PROXY hop count must be a positive integer");
        }
        if (isProductionEnvironment()) {
            throw new AppError(
                500,
                "TRUST_PROXY numeric hop counts are not allowed in production; set an explicit comma-separated proxy address list",
            );
        }
        return hops;
    }
    return tokens;
}

/** Proxy addresses that Better Auth may trust for forwarded-IP headers. */
export function getBetterAuthTrustedProxies(): string[] {
    const setting = getExpressTrustProxy();
    if (Array.isArray(setting)) return setting;
    return [];
}

/** Forwarded-IP headers are only read when a proxy is explicitly trusted. */
export function getBetterAuthIpHeaders(): string[] {
    const setting = getExpressTrustProxy();
    if (setting === false || (Array.isArray(setting) && setting.length === 0)) {
        return [];
    }
    return ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"];
}
