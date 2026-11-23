import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db.js";
import {
    getAllowedOrigins,
    getBetterAuthIpHeaders,
    getBetterAuthTrustedProxies,
    isProductionEnvironment,
} from "../config/network.js";

const allowedOrigins = getAllowedOrigins();
const isProduction = isProductionEnvironment();
const trustedProxies = getBetterAuthTrustedProxies();
const ipAddressHeaders = getBetterAuthIpHeaders();

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8081",
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [
        ...allowedOrigins,
        "http://localhost:3000",
        "http://localhost:8081",
    ],
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
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