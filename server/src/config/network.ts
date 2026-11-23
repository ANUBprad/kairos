import { AppError } from "../types/app-error.js";

const LOCALHOST_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
];

export function isProductionEnvironment(): boolean {
    return (
        process.env.NODE_ENV === "production" ||
        process.env.BETTER_AUTH_URL?.startsWith("https://") === true
    );
}

function parseOrigin(value: string): string {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new AppError(500, "CLIENT_URL contains an invalid origin");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new AppError(500, "CLIENT_URL origins must use http or https");
    }
    if (isProductionEnvironment() && parsed.protocol !== "https:") {
        throw new AppError(500, "CLIENT_URL must use https in production");
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

    return origins;
}

function parseTrustedProxyTokens(): string[] {
    return (process.env.TRUST_PROXY || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

/** Express trust-proxy setting. Nothing is trusted unless explicitly configured. */
export function getExpressTrustProxy(): false | number | string | string[] {
    const tokens = parseTrustedProxyTokens();
    if (tokens.length === 0) return false;
    if (tokens.length === 1 && /^\d+$/.test(tokens[0])) {
        const hops = Number(tokens[0]);
        if (!Number.isInteger(hops) || hops < 1) {
            throw new AppError(500, "TRUST_PROXY hop count must be a positive integer");
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
    return getExpressTrustProxy() === false
        ? []
        : ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"];
}
