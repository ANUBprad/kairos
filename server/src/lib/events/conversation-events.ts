import { summarizeConversationById } from "../../services/conversation-memory.services.js";
import { sendInngestEvent } from "./inngest-send.js";


/**
 * Enqueues an asynchronous rolling conversation summary job via Inngest.
 *
 * @param input - Object containing conversationId and userId
 * @returns Resolves when event is sent to Inngest
 */
export async function enqueueConversationSummarize(input: {
    conversationId: string;
    userId: string;
}) {
    // Deterministic id keeps repeated submissions of the same summary job from
    // creating duplicate Inngest runs.
    const jobKey = `conversation-summarize:${input.conversationId}`;
    const accepted = await sendInngestEvent({
        id: jobKey,
        name: "conversation/summarize",
        data: { ...input, jobKey },
    });

    if (!accepted) {
        void summarizeConversationById(
            input.conversationId,
            input.userId,
        ).catch((err) => {
            console.error(
                `Conversation summarize failed for ${input.conversationId}:`,
                err,
            );
        });
    }
}