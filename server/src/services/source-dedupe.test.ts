import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import type {
    CreateSourceData,
    SourceRecord,
} from "../repository/source.repository.js";
import {
    findActiveDuplicateInTransaction,
    insertSourceCreationInTransaction,
    sourceIdentityFor,
} from "./source.services.js";

const EXISTING = {
    id: "source-existing",
    workspaceId: "workspace-1",
    type: "WEBSITE",
    title: "Existing page",
    content: "readable content",
    url: "https://example.test/article",
    status: "READY",
    metadata: { websiteIdentity: "example.test/article" },
    createdAt: new Date("2026-11-28T00:00:00.000Z"),
    updatedAt: new Date("2026-11-28T00:00:00.000Z"),
} as SourceRecord;

function duplicateTx(existing: SourceRecord | null) {
    let findCalls = 0;
    let createCalls = 0;
    const tx = {
        source: {
            findFirst: async (args: Prisma.SourceFindFirstArgs) => {
                findCalls += 1;
                const statusValue =
                    args.where && typeof args.where.status === "object" && "in" in args.where.status
                        ? args.where.status.in
                        : undefined;
                const statuses = Array.isArray(statusValue) ? statusValue : undefined;
                if (!existing || (statuses && !statuses.includes(existing.status))) {
                    return null;
                }
                return existing;
            },
            create: async () => {
                createCalls += 1;
                throw new Error("duplicate import must not create a source");
            },
        },
        user: {
            findUnique: async () => {
                throw new Error("duplicate import must not check quota or credits");
            },
        },
    };
    return {
        tx: tx as unknown as Prisma.TransactionClient,
        counts: () => ({ findCalls, createCalls }),
    };
}

describe("source import identity dedupe", () => {
    it("derives stable identities for all imported source kinds", () => {
        assert.deepEqual(
            sourceIdentityFor({
                workspaceId: "w1",
                type: "WEBSITE",
                title: "Page",
                metadata: { websiteIdentity: "example.test/page" },
            }),
            { field: "metadata", metadataKey: "websiteIdentity", metadataValue: "example.test/page" },
        );
        assert.deepEqual(
            sourceIdentityFor({
                workspaceId: "w1",
                type: "PDF",
                title: "Doc",
                metadata: { contentHash: "abc123" },
            }),
            { field: "metadata", metadataKey: "contentHash", metadataValue: "abc123" },
        );
        assert.deepEqual(
            sourceIdentityFor({
                workspaceId: "w1",
                type: "GITHUB_REPO",
                title: "Repo",
                url: "https://github.com/owner/repo",
            }),
            { field: "url", url: "https://github.com/owner/repo" },
        );
        assert.deepEqual(
            sourceIdentityFor({
                workspaceId: "w1",
                type: "NOTION_PAGE",
                title: "Page",
                metadata: { notionPageId: "page-1" },
            }),
            { field: "metadata", metadataKey: "notionPageId", metadataValue: "page-1" },
        );
        assert.equal(
            sourceIdentityFor({
                workspaceId: "w1",
                type: "TEXT",
                title: "Note",
                content: "same text",
            }),
            null,
        );
    });

    it("reuses an active source without a second row or charge", async () => {
        const { tx, counts } = duplicateTx(EXISTING);
        const data: CreateSourceData = {
            workspaceId: "workspace-1",
            type: "WEBSITE",
            title: "Duplicate page",
            content: "duplicate content",
            url: "https://example.test/article",
            metadata: { websiteIdentity: "example.test/article" },
        };

        const result = await insertSourceCreationInTransaction(tx, {
            sourceId: "source-new",
            userId: "user-1",
            data,
            chargeIdempotencyKey: "source-charge:source-new",
            jobKey: "source.process:source-new",
        });

        assert.equal(result.id, EXISTING.id);
        assert.deepEqual(counts(), { findCalls: 1, createCalls: 0 });
    });

    it("ignores terminal failed sources so retries create a fresh charge", async () => {
        const failed = {
            ...EXISTING,
            id: "source-failed",
            status: "FAILED" as const,
        } as SourceRecord;
        const { tx } = duplicateTx(failed);
        const identity = await findActiveDuplicateInTransaction(tx, {
            workspaceId: "workspace-1",
            type: "WEBSITE",
            title: "Retry",
            metadata: { websiteIdentity: "example.test/article" },
        });
        assert.equal(identity, null, "failed sources must not block re-import");
    });
});
