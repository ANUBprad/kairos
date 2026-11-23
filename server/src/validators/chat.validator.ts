import { z } from "zod";
import { CHAT_MODELS } from "../lib/ai-config.js";
import { workspaceIdParamSchema } from "./workspace.validator.js";

export const conversationIdParamSchema = workspaceIdParamSchema.extend({
    conversationId: z.string().trim().min(1, "Conversation id is required"),
});

const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_BODY_BYTES = 256 * 1024;
const MAX_SINGLE_MESSAGE_BYTES = 32 * 1024;

export const chatBodySchema = z
    .object({
        conversationId: z.string().trim().min(1).optional(),
        messages: z
            .array(z.record(z.string(), z.unknown()))
            .min(1)
            .max(MAX_CHAT_MESSAGES, "Too many messages in one request"),
        model: z.enum(CHAT_MODELS).optional(),
        webSearch: z.boolean().optional(),
    })
    .superRefine((value, ctx) => {
        let total = 0;
        for (const message of value.messages) {
            const size = Buffer.byteLength(JSON.stringify(message), "utf8");
            total += size;
            if (size > MAX_SINGLE_MESSAGE_BYTES) {
                ctx.addIssue({
                    code: "custom",
                    path: ["messages"],
                    message: "A chat message exceeds the size limit",
                });
                return;
            }
        }
        if (total > MAX_CHAT_BODY_BYTES) {
            ctx.addIssue({
                code: "custom",
                path: ["messages"],
                message: "Chat request is too large",
            });
        }
    });

export type ChatBody = z.infer<typeof chatBodySchema>;

export const createConversationSchema = z.object({
    title: z.string().trim().min(1).max(120).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const enhancePromptSchema = z.object({
    prompt: z.string().trim().min(1).max(8000),
    sourcesCount: z.number().int().min(0).optional(),
});

export type EnhancePromptInput = z.infer<typeof enhancePromptSchema>;