import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db.js";
import {
    getAllowedOrigins,
    getBetterAuthIpHeaders,
    getBetterAuthTrustedProxies,
    isProductionEnvironment,
} from "../config/network.js";
import { grantSignupCreditsForUser } from "./signup-credits.js";

const allowedOrigins = getAllowedOrigins();
const isProduction = isProductionEnvironment();
const configuredBaseUrl = process.env.BETTER_AUTH_URL;
if (isProduction && !configuredBaseUrl) {
    throw new Error("BETTER_AUTH_URL is required in production");
}
const trustedProxies = getBetterAuthTrustedProxies();
const ipAddressHeaders = getBetterAuthIpHeaders();

export const auth = betterAuth({
    baseURL: configuredBaseUrl || "http://localhost:8081",
    secret: process.env.BETTER_AUTH_SECRET,
    // getAllowedOrigins() only appends localhost origins outside production.
    // Adding them here as well would silently trust them in production.
    trustedOrigins: allowedOrigins,
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    databaseHooks: {
        user: {
            create: {
                // The schema defaults credits to 0; this hook grants the 50
                // welcome credits exactly once via an idempotent ledger entry.
                after: async (user) => {
                    await grantSignupCreditsForUser({ id: user.id });
                },
            },
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
    },
    advanced: {
        defaultCookieAttributes: {
            sameSite: isProduction ? "none" : "lax",
            secure: isProduction,
            partitioned: isProduction,
        },
        ipAddress: {
            ipAddressHeaders,
            ...(trustedProxies.length > 0 ? { trustedProxies } : {}),
        },
    },
});