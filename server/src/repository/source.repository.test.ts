import assert from "node:assert/strict";
import { describe, it } from "node:test";

type FindFirstArgs = {
    where: {
        workspaceId: string;
        type: string;
        status: { in: string[] };
        metadata: { path: string[]; equals: string };
    };
};

const calls: FindFirstArgs[] = [];
const existingSource = {
    id: "source-1",
    workspaceId: "workspace-1",
    type: "YOUTUBE",
    title: "Existing video",
    content: "transcript",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    status: "READY",
    metadata: { videoId: "dQw4w9WgXcQ" },
    createdAt: new Date(),
    updatedAt: new Date(),
};

Object.assign(globalThis, {
    prisma: {
        source: {
            findFirst: async (args: FindFirstArgs) => {
                calls.push(args);
                return existingSource;
            },
        },
    },
});

const { findActiveSourceByMetadataKey } = await import("./source.repository.js");

describe("active source lookup by metadata identity", () => {
    it("looks only in the owning workspace for non-terminal sources", async () => {
        const found = await findActiveSourceByMetadataKey(
            "workspace-1",
            "YOUTUBE",
            "videoId",
            "dQw4w9WgXcQ",
        );

        assert.equal(found?.id, "source-1");
        assert.deepEqual(calls.at(-1)?.where.status.in, [
            "PENDING",
            "PROCESSING",
            "READY",
        ]);
        assert.deepEqual(calls.at(-1)?.where.metadata, {
            path: ["videoId"],
            equals: "dQw4w9WgXcQ",
        });
    });
});
