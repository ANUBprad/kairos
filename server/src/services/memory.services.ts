import {
    addUserMemory,
    updateUserMemory,
} from "../lib/mem0.js";

/**
 * Creates a user-authored memory (not inferred by Mem0).
 *
 * @param userId - Owner of the memory
 * @param input - Raw memory text from the client
 * @returns Created Mem0 memory record
 * @throws {ValidationError} When memory text is empty after trimming
 *
 *
 */
export function createMemoryForUser(
    userId: string,
    input: { memory: string },
) {
    return addUserMemory(userId, {
        memory: input.memory,
        infer: false,
        metadata: { source: "manual" },
    });
}

/**
 * Updates the text of an existing memory by id after verifying ownership.
 *
 * @param userId - Authenticated owner of the memory
 * @param memoryId - Mem0 memory id to update
 * @param input - New memory text
 * @returns Updated Mem0 memory record
 * @throws {NotFoundError} When the memory is missing or owned by another user
 *
 */
export function updateMemoryForUser(
    userId: string,
    memoryId: string,
    input: { memory: string },
) {
    return updateUserMemory(memoryId, input, userId);
}