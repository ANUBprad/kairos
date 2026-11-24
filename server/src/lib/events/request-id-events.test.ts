import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { runWithRequestId } from "../observability/request-context.js";

type CapturedEvent = {
    data?: Record<string, unknown>;
    name?: string;
};

describe("Inngest event correlation", () => {
    const originalDev = process.env.INNGEST_DEV;

    after(() => {
        if (originalDev === undefined) delete process.env.INNGEST_DEV;
        else process.env.INNGEST_DEV = originalDev;
    });

    it("adds the active request id to queued worker events", async () => {
        // Dev-server mode makes sendInngestEvent call the (stubbed) SDK client
        // instead of taking the in-process fallback. No provider is contacted.
        process.env.INNGEST_DEV = "1";
        const { inngest } = await import("../../inngest/client.js");
        const originalSend = inngest.send;
        const sent: CapturedEvent[] = [];
        (inngest as unknown as { send: unknown }).send = async (
            payload: CapturedEvent,
        ) => {
            sent.push(payload);
            return { ids: [] };
        };

        try {
            const { enqueueSourceProcessing } = await import("./source-events.js");
            const { enqueueArtifactGeneration } = await import("./artifact-events.js");
            const { enqueueConversationSummarize } = await import("./conversation-events.js");

            await runWithRequestId("trace-event12345", async () => {
                await enqueueSourceProcessing({
                    sourceId: "source-1",
                    workspaceId: "workspace-1",
                });
                await enqueueArtifactGeneration({
                    artifactId: "artifact-1",
                    workspaceId: "workspace-1",
                });
                await enqueueConversationSummarize({
                    conversationId: "conversation-1",
                    userId: "user-1",
                });
            });

            assert.equal(sent.length, 3);
            assert.deepEqual(
                sent.map((event) => event.name),
                ["source/created", "artifact/generate", "conversation/summarize"],
            );
            for (const event of sent) {
                assert.equal(event.data?.requestId, "trace-event12345");
            }
        } finally {
            (inngest as unknown as { send: unknown }).send = originalSend;
        }
    });
});
