import { z } from "zod";

const placeholderPattern = /^(your_|sk-proj-your|fc-your|tvly-|m0-your|rzp_test_your)/i;

function isPlaceholder(value: string | undefined): boolean {
    if (!value) return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    return placeholderPattern.test(trimmed);
}

const baseSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    PORT: z.coerce.number().int().positive().default(8081),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    CLIENT_URL: z.string().min(1, "CLIENT_URL is required"),
    SERVER_URL: z.string().url().optional(),
    BETTER_AUTH_SECRET: z
        .string()
        .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_INDEX: z.string().optional(),
    ELEVENLABS_API_KEY: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
    FIRECRAWL_API_KEY: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    /** Explicit deployment identity; never inferred from credentials. */
    DEPLOYMENT_ENV: z.enum(["local", "staging", "production"]).optional(),
    OAUTH_STATE_SECRET: z
        .string()
        .min(32, "OAUTH_STATE_SECRET must be at least 32 characters")
        .optional(),
    TRUST_PROXY: z.string().optional(),
    /** Required marker proving the staging DB belongs to the staging environment. */
    STAGING_DATABASE_ID: z.string().min(4).optional(),
    /** Required marker for staging-owned storage buckets / upload presets. */
    STAGING_RESOURCE_PREFIX: z.string().min(4).optional(),
    /** Optional explicit denylist of production URLs, hosts, or database names. */
    STAGING_FORBIDDEN_ENDPOINTS: z.string().optional(),
    /** If set, staging may never use this exact database URL. */
    PRODUCTION_DATABASE_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof baseSchema>;

let cached: ServerEnv | null = null;

/** @internal Test helper */
export function resetServerEnvCacheForTests(): void {
    cached = null;
}

function deploymentEnvOf(env: ServerEnv): "local" | "staging" | "production" {
    return (
        env.DEPLOYMENT_ENV ??
        (env.NODE_ENV === "production" ? "production" : "local")
    );
}

function looksStaging(value: string | undefined): boolean {
    return /stage|staging|sandbox|test/i.test(value ?? "");
}

function looksProduction(value: string | undefined): boolean {
    const normalized = (value ?? "").toLowerCase();
    return /prod(uction)?/.test(normalized) && !looksStaging(normalized);
}

function forbiddenEndpoints(env: ServerEnv): string[] {
    return (env.STAGING_FORBIDDEN_ENDPOINTS ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}

function assertStagingIsolation(env: ServerEnv): void {
    if (env.NODE_ENV !== "production") {
        throw new Error(
            "DEPLOYMENT_ENV=staging requires NODE_ENV=production so production middleware and secure cookies are used.",
        );
    }

    // Never allow live payment credentials outside an explicitly production
    // deployment. A staging service must fail closed if a live key is copied.
    if (/^rzp_live_/i.test(env.RAZORPAY_KEY_ID?.trim() ?? "")) {
        throw new Error(
            "Live Razorpay credentials are not allowed in local or staging deployments.",
        );
    }

    const required: (keyof ServerEnv)[] = [
        "SERVER_URL",
        "OAUTH_STATE_SECRET",
        "STAGING_DATABASE_ID",
        "STAGING_RESOURCE_PREFIX",
    ];
    const missing = required.filter((key) => isPlaceholder(env[key] as string | undefined));
    if (!isPlaceholder(env.RAZORPAY_KEY_ID)) {
        if (!/^rzp_test_/i.test(env.RAZORPAY_KEY_ID!.trim())) {
            throw new Error(
                "Only Razorpay test-mode keys (rzp_test_*) are allowed in staging.",
            );
        }
        required.push("RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET");
        for (const key of ["RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] as const) {
            if (isPlaceholder(env[key])) missing.push(key);
        }
    }
    if (missing.length > 0) {
        throw new Error(
            `Missing or placeholder staging configuration: ${[...new Set(missing)].join(", ")}`,
        );
    }

    if (env.OAUTH_STATE_SECRET === env.BETTER_AUTH_SECRET) {
        throw new Error(
            "Staging OAUTH_STATE_SECRET must be distinct from BETTER_AUTH_SECRET.",
        );
    }

    const dbIdentity = `${env.DATABASE_URL}`;
    const stagingDbId = env.STAGING_DATABASE_ID!.trim().toLowerCase();
    if (!dbIdentity.toLowerCase().includes(stagingDbId)) {
        throw new Error(
            "Staging DATABASE_URL must contain STAGING_DATABASE_ID; refusing an unidentified or production database.",
        );
    }
    let parsedDb: URL;
    try {
        parsedDb = new URL(env.DATABASE_URL);
    } catch {
        throw new Error("Staging DATABASE_URL must be a valid URL.");
    }
    const dbHost = parsedDb.hostname.toLowerCase();
    const dbName = decodeURIComponent(parsedDb.pathname.replace(/^\//, "")).toLowerCase();
    if (looksProduction(dbHost) || looksProduction(dbName)) {
        throw new Error(
            "Staging DATABASE_URL looks like a production endpoint; refusing to start.",
        );
    }
    if (
        env.PRODUCTION_DATABASE_URL &&
        env.PRODUCTION_DATABASE_URL.trim() === env.DATABASE_URL.trim()
    ) {
        throw new Error(
            "Staging DATABASE_URL matches PRODUCTION_DATABASE_URL; refusing to start.",
        );
    }

    const endpoints = [
        env.DATABASE_URL,
        env.CLIENT_URL,
        env.SERVER_URL,
        env.BETTER_AUTH_URL,
        env.CLOUDINARY_CLOUD_NAME,
    ].map((value) => (value ?? "").toLowerCase());
    for (const forbidden of forbiddenEndpoints(env)) {
        if (endpoints.some((value) => value.includes(forbidden))) {
            throw new Error(
                "Staging configuration contains an explicitly forbidden production endpoint.",
            );
        }
    }

    const prefix = env.STAGING_RESOURCE_PREFIX!.trim().toLowerCase();
    const storage = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_UPLOAD_PRESET]
        .filter((value): value is string => !!value && !isPlaceholder(value))
        .map((value) => value.toLowerCase());
    for (const value of storage) {
        if (!value.includes(prefix) && !looksStaging(value)) {
            throw new Error(
                "Staging Cloudinary configuration is not marked as staging-owned; refusing possible production storage writes.",
            );
        }
        if (looksProduction(value)) {
            throw new Error(
                "Staging Cloudinary configuration looks like a production resource; refusing to start.",
            );
        }
    }
}

/**
 * Validates process.env at startup. Production requires real AI/storage credentials.
 * Validated values are cached only after every environment gate passes: a failed
 * validation must not leave a usable cached config behind.
 */
export function getServerEnv(): ServerEnv {
    if (cached) return cached;

    const parsed = baseSchema.safeParse(process.env);
    if (!parsed.success) {
        const message = parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n");
        throw new Error(`Invalid server environment:\n${message}`);
    }

    const env = parsed.data;
    const deploymentEnv = deploymentEnvOf(env);

    if (deploymentEnv === "staging") {
        assertStagingIsolation(env);
    } else if (
        deploymentEnv !== "production" &&
        /^rzp_live_/i.test(env.RAZORPAY_KEY_ID?.trim() ?? "")
    ) {
        throw new Error(
            "Live Razorpay credentials are not allowed in local or staging deployments.",
        );
    }

    if (env.NODE_ENV === "production") {
        const requiredInProd: (keyof ServerEnv)[] = [
            "OPENAI_API_KEY",
            "PINECONE_API_KEY",
            "PINECONE_INDEX",
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET",
        ];
        const missing = requiredInProd.filter((key) =>
            isPlaceholder(env[key] as string | undefined),
        );
        // Payments are optional, but when Razorpay is enabled the webhook secret
        // is mandatory or every genuine webhook fails HMAC verification.
        if (!isPlaceholder(env.RAZORPAY_KEY_ID)) {
            for (const key of [
                "RAZORPAY_KEY_SECRET",
                "RAZORPAY_WEBHOOK_SECRET",
            ] as const) {
                if (isPlaceholder(env[key])) missing.push(key);
            }
        }
        if (missing.length > 0) {
            throw new Error(
                `Missing or placeholder production env: ${missing.join(", ")}`,
            );
        }
    } else {
        const optionalWarnings = [
            "OPENAI_API_KEY",
            "PINECONE_API_KEY",
            "GEMINI_API_KEY",
        ] as const;
        for (const key of optionalWarnings) {
            if (isPlaceholder(process.env[key])) {
                console.warn(
                    `[env] ${key} is unset or placeholder — related features may fail.`,
                );
            }
        }
    }

    cached = env;
    return env;
}

/** Call once before the HTTP server listens. */
export function assertServerEnv(): ServerEnv {
    return getServerEnv();
}
