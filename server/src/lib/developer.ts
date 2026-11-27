import prisma from "./db.js";
import type { Prisma } from "../generated/prisma/client.js";

/**
 * Parses the server-owned developer allowlist. Entries are exact email
 * addresses: wildcards, domains and sub-addresses are never expanded.
 */
export function parseDeveloperEmails(value: string | null | undefined): string[] {
    if (!value) return [];
    const emails = value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
    return [...new Set(emails)];
}

/** Reads the allowlist from the process environment at call time. */
export function getDeveloperEmails(): string[] {
    return parseDeveloperEmails(process.env.DEVELOPER_EMAILS);
}

/** Exact, normalized match only. This never inspects client-provided flags. */
export function isDeveloperEmail(email: string | null | undefined): boolean {
    if (typeof email !== "string") return false;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return false;
    return getDeveloperEmails().includes(normalized);
}

/**
 * Resolves developer status from the user row visible to the caller's
 * transaction. The email always comes from the database/session identity,
 * never from a request body or client hint.
 */
export async function isDeveloperInReader(
    reader: Pick<Prisma.TransactionClient, "user">,
    userId: string,
): Promise<boolean> {
    if (!userId || getDeveloperEmails().length === 0) return false;
    const user = await reader.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });
    return isDeveloperEmail(user?.email);
}

/** Shared-client variant for callers that do not already own a transaction. */
export async function isDeveloperUser(userId: string): Promise<boolean> {
    return isDeveloperInReader(prisma, userId);
}
