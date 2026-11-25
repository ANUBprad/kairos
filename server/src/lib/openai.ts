import {
    CHAT_MODEL,
    GEMINI_CHAT_MODEL,
    GEMINI_SECONDARY_CHAT_MODEL,
} from "./ai-config.js";

/** Rough USD estimate for chat + embed tokens (dev observability only). */
export function estimateChatCostUsd(
    model: string,
    input: { promptTokens?: number; completionTokens?: number; embedTokens?: number },
): number | undefined {
    const prompt = input.promptTokens ?? 0;
    const completion = input.completionTokens ?? 0;
    const embed = input.embedTokens ?? 0;

    if (prompt + completion + embed === 0) {
        return undefined;
    }

    // Gemini billing varies by plan and free-tier eligibility; do not report a
    // misleading dollar figure for it.
    if (model === GEMINI_CHAT_MODEL || model === GEMINI_SECONDARY_CHAT_MODEL) {
        return undefined;
    }

    const rates: Record<string, { in: number; out: number }> = {
        "gpt-4o-mini": { in: 0.15 / 1_000_000, out: 0.6 / 1_000_000 },
        "gpt-4o": { in: 2.5 / 1_000_000, out: 10 / 1_000_000 },
    };

    const rate = rates[model] ?? rates[CHAT_MODEL] ?? rates["gpt-4o-mini"]!;
    const embedRate = 0.02 / 1_000_000;

    return prompt * rate.in + completion * rate.out + embed * embedRate;
}
