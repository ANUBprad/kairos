import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";

export const messageSelect = {
    id: true,
    conversationId: true,
    role: true,
    content: true,
    citations: true,
    createdAt: true,
} as const;

export type MessageRecord = Prisma.MessageGetPayload<{
    select: typeof messageSelect;
}>;

export type CreateMessageData = {
    conversationId: string;
    role: MessageRecord["role"];
    content: string;
    citations?: Prisma.InputJsonValue;
    requestKey?: string;
};

/**
 * Queries the most recent messages in a conversation in chronological order.
 * The bounded take keeps history loading predictable; very old messages are
 * intentionally excluded once a conversation exceeds the cap.
 *
 * @param conversationId - Unique identifier of the conversation
 * @returns Promise resolving to list of message records
 */
export async function findMessagesByConversationId(conversationId: string) {
    const messages = await prisma.message.findMany({
        where: { conversationId },
        select: messageSelect,
        orderBy: { createdAt: "desc" },
        take: 200,
    });
    return messages.reverse();
}

/**
 * Counts the total number of messages in a given conversation.
 *
 * @param conversationId - Unique identifier of the conversation
 * @returns Promise resolving to message count integer
 */
export function countMessagesByConversationId(conversationId: string) {
    return prisma.message.count({
        where: { conversationId },
    });
}

/**
 * Inserts a new chat message record (USER or ASSISTANT) with optional citations into PostgreSQL.
 *
 * @param data - Message payload containing conversationId, role, content, and citations
 * @returns Promise resolving to the newly created message record
 */
export function createMessageRecord(data: CreateMessageData) {
    return prisma.message.create({
        data: {
            conversationId: data.conversationId,
            role: data.role,
            content: data.content,
            citations: data.citations,
            requestKey: data.requestKey,
        },
        select: messageSelect,
    });
}

/**
 * Idempotent reservation of a USER message inside the caller's transaction.
 * With a request key, a retried request reuses the winning row instead of
 * inserting another message (and therefore another quota unit/charge).
 */
export async function reserveUserMessageInTransaction(
    tx: Prisma.TransactionClient,
    data: CreateMessageData & { requestKey?: string },
): Promise<{ message: MessageRecord; created: boolean }> {
    if (!data.requestKey) {
        const message = await tx.message.create({
            data: {
                conversationId: data.conversationId,
                role: data.role,
                content: data.content,
                citations: data.citations,
            },
            select: messageSelect,
        });
        return { message, created: true };
    }

    const existing = await tx.message.findUnique({
        where: { requestKey: data.requestKey },
        select: messageSelect,
    });
    if (existing) return { message: existing, created: false };

    const inserted = await tx.message.createMany({
        data: [
            {
                conversationId: data.conversationId,
                role: data.role,
                content: data.content,
                citations: data.citations,
                requestKey: data.requestKey,
            },
        ],
        skipDuplicates: true,
    });
    const message = await tx.message.findUniqueOrThrow({
        where: { requestKey: data.requestKey },
        select: messageSelect,
    });
    return { message, created: inserted.count === 1 };
}

/** Removes a single message, used when a message could not be charged. */
export function deleteMessageRecord(messageId: string) {
    return prisma.message.delete({
        where: { id: messageId },
    });
}

/**
 * Removes all messages in a conversation (keeps the conversation row).
 */
export function deleteMessagesByConversationId(conversationId: string) {
    return prisma.message.deleteMany({
        where: { conversationId },
    });
}