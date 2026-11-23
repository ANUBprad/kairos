function requireUrl(name: string, value: string | undefined, fallback?: string): string {
    const resolved = value?.trim() || fallback;
    if (!resolved) {
        throw new Error(`${name} is required (see client/.env.example)`);
    }
    try {
        new URL(resolved);
    } catch {
        throw new Error(`${name} must be a valid URL`);
    }
    return resolved.replace(/\/$/, "");
}

function looksStaging(value: string): boolean {
    return /stage|staging|sandbox|test/i.test(value);
}

function looksProduction(value: string): boolean {
    return /prod(uction)?/i.test(value) && !looksStaging(value);
}

/**
 * Fail closed if a staging deployment is pointed at a production endpoint.
 * This runs during `next build`, before any request can be rewritten.
 */
function assertStagingBrowserTarget(name: string, value: string): void {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
        throw new Error(`${name} must use https in staging`);
    }
    if (parsed.username || parsed.password) {
        throw new Error(`${name} must not contain credentials`);
    }
    const target = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    if (looksProduction(target)) {
        throw new Error(`${name} looks like a production endpoint; refusing staging build`);
    }
    if (!looksStaging(target)) {
        throw new Error(`${name} is not marked as staging-owned; refusing staging build`);
    }
}

export type ClientEnv = {
    apiUrl: string;
    authUrl: string;
};

let cached: ClientEnv | null = null;

export function getClientEnv(): ClientEnv {
    if (cached) return cached;

    const apiUrl = requireUrl(
        "NEXT_PUBLIC_API_URL",
        process.env.NEXT_PUBLIC_API_URL,
        "http://localhost:8081",
    );
    const authUrl = requireUrl(
        "NEXT_PUBLIC_BETTER_AUTH_URL",
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
        apiUrl,
    );

    if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL must be set in production");
    }

    if (process.env.DEPLOYMENT_ENV === "staging") {
        assertStagingBrowserTarget("NEXT_PUBLIC_API_URL", apiUrl);
        assertStagingBrowserTarget("NEXT_PUBLIC_BETTER_AUTH_URL", authUrl);
    }

    cached = { apiUrl, authUrl };
    return cached;
}

/**
 * Server-side rewrite target for `/api/*`. In staging it must be either the
 * already-validated public staging API URL or an explicitly staging-marked
 * internal URL. It can never be a production endpoint.
 */
export function getBackendInternalUrl(): string {
    const apiUrl = getClientEnv().apiUrl;
    const resolved = requireUrl(
        "BACKEND_INTERNAL_URL",
        process.env.BACKEND_INTERNAL_URL,
        apiUrl,
    );
    if (process.env.DEPLOYMENT_ENV === "staging") {
        const parsed = new URL(resolved);
        if (parsed.username || parsed.password) {
            throw new Error("BACKEND_INTERNAL_URL must not contain credentials");
        }
        const target = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
        if (looksProduction(target)) {
            throw new Error("BACKEND_INTERNAL_URL looks like production; refusing staging rewrite");
        }
        if (!looksStaging(target) && resolved !== apiUrl) {
            throw new Error(
                "BACKEND_INTERNAL_URL must be staging-marked or equal NEXT_PUBLIC_API_URL; refusing staging rewrite",
            );
        }
    }
    return resolved;
}
