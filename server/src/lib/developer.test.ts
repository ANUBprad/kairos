import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import {
    getDeveloperEmails,
    isDeveloperEmail,
    isDeveloperInReader,
    parseDeveloperEmails,
} from "./developer.js";

const ORIGINAL_DEVELOPER_EMAILS = process.env.DEVELOPER_EMAILS;

async function withDeveloperEmails<T>(
    value: string | undefined,
    fn: () => T | Promise<T>,
): Promise<T> {
    const previous = process.env.DEVELOPER_EMAILS;
    if (value === undefined) delete process.env.DEVELOPER_EMAILS;
    else process.env.DEVELOPER_EMAILS = value;
    try {
        return await fn();
    } finally {
        if (previous === undefined) delete process.env.DEVELOPER_EMAILS;
        else process.env.DEVELOPER_EMAILS = previous;
    }
}

function readerWithEmail(email: string | null) {
    const calls: Array<Record<string, unknown>> = [];
    const reader = {
        user: {
            findUnique: async (args: Record<string, unknown>) => {
                calls.push(args);
                return email === null ? null : { email };
            },
        },
    };
    return {
        reader: reader as unknown as Pick<Prisma.TransactionClient, "user">,
        calls,
    };
}

after(() => {
    if (ORIGINAL_DEVELOPER_EMAILS === undefined) delete process.env.DEVELOPER_EMAILS;
    else process.env.DEVELOPER_EMAILS = ORIGINAL_DEVELOPER_EMAILS;
});

describe("developer allowlist", () => {
    it("normalizes comma-separated emails and de-duplicates them", () => {
        assert.deepEqual(
            parseDeveloperEmails("  Developer@Example.test , second@example.test,developer@example.test, ,"),
            ["developer@example.test", "second@example.test"],
        );
        assert.deepEqual(parseDeveloperEmails(undefined), []);
        assert.deepEqual(parseDeveloperEmails(""), []);
    });

    it("reads DEVELOPER_EMAILS from the server environment at call time", async () => {
        await withDeveloperEmails(" Dev@Example.test , other@example.test ", () => {
            assert.deepEqual(getDeveloperEmails(), ["dev@example.test", "other@example.test"]);
            assert.equal(isDeveloperEmail("DEV@example.test"), true);
            assert.equal(isDeveloperEmail("other@EXAMPLE.TEST"), true);
        });
        await withDeveloperEmails(undefined, () => {
            assert.deepEqual(getDeveloperEmails(), []);
            assert.equal(isDeveloperEmail("dev@example.test"), false);
        });
    });

    it("matches exact addresses only, never domains or client flags", async () => {
        await withDeveloperEmails("developer@example.test,example.test", () => {
            assert.equal(isDeveloperEmail("developer@example.test"), true);
            assert.equal(isDeveloperEmail("someone@example.test"), false);
            assert.equal(isDeveloperEmail("*@example.test"), false);
            assert.equal(isDeveloperEmail(null), false);
            assert.equal(isDeveloperEmail(undefined), false);
            // A client-controlled boolean is not an email and cannot grant access.
            assert.equal(isDeveloperEmail(true as unknown as string), false);
        });
    });

    it("resolves status from the database identity with an email-only select", async () => {
        await withDeveloperEmails("Developer@Example.test", async () => {
            const allowed = readerWithEmail("Developer@Example.test");
            assert.equal(await isDeveloperInReader(allowed.reader, "user-1"), true);
            assert.equal(allowed.calls.length, 1);
            assert.deepEqual(allowed.calls[0], {
                where: { id: "user-1" },
                select: { email: true },
            });

            const denied = readerWithEmail("someone@example.test");
            assert.equal(await isDeveloperInReader(denied.reader, "user-2"), false);

            const missing = readerWithEmail(null);
            assert.equal(await isDeveloperInReader(missing.reader, "user-3"), false);
        });
    });

    it("does not read a user row when there is no allowlist", async () => {
        await withDeveloperEmails(undefined, async () => {
            const { reader, calls } = readerWithEmail("developer@example.test");
            assert.equal(await isDeveloperInReader(reader, "user-1"), false);
            assert.equal(calls.length, 0);
        });
    });

    it("exposes DEVELOPER_EMAILS as an optional server env string", async () => {
        const keys = [
            "NODE_ENV",
            "DEPLOYMENT_ENV",
            "DATABASE_URL",
            "CLIENT_URL",
            "BETTER_AUTH_SECRET",
            "DEVELOPER_EMAILS",
        ] as const;
        const original = new Map(keys.map((key) => [key, process.env[key]]));
        try {
            for (const key of keys) delete process.env[key];
            process.env.NODE_ENV = "development";
            process.env.DATABASE_URL = "postgresql://localhost:5432/kairos";
            process.env.CLIENT_URL = "http://localhost:3000";
            process.env.BETTER_AUTH_SECRET = "x".repeat(32);
            process.env.DEVELOPER_EMAILS = "developer@example.test";

            const { getServerEnv, resetServerEnvCacheForTests } = await import("../config/env.js");
            resetServerEnvCacheForTests();
            assert.equal(getServerEnv().DEVELOPER_EMAILS, "developer@example.test");
            resetServerEnvCacheForTests();
        } finally {
            for (const [key, value] of original) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        }
    });
});
