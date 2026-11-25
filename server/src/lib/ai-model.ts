import { createGoogle } from "@ai-sdk/google";
import { openai as openAiProvider } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import {
    CHAT_PROVIDER,
    resolveChatModelId,
    type AiProvider,
} from "./ai-config.js";

type GoogleProvider = ReturnType<typeof createGoogle>;
type OpenAiProvider = typeof openAiProvider;

let googleProvider: GoogleProvider | null = null;

function credentialError(provider: AiProvider): Error {
    if (provider === "gemini") {
        return new Error(
            "GEMINI_API_KEY is not configured. Set it to use Gemini, or set CHAT_PROVIDER=openai with OPENAI_API_KEY.",
        );
    }
    return new Error(
        "OPENAI_API_KEY is not configured. Set it to use OpenAI, or set CHAT_PROVIDER=gemini with GEMINI_API_KEY.",
    );
}

function getGoogleProvider(): GoogleProvider {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw credentialError("gemini");

    if (!googleProvider) {
        googleProvider = createGoogle({ apiKey });
    }
    return googleProvider;
}

function getOpenAiProvider(): OpenAiProvider {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw credentialError("openai");
    return openAiProvider;
}

/** Returns the configured provider model for a validated client model id. */
export function getChatModel(requestedModel?: string): LanguageModel {
    const modelId = resolveChatModelId(requestedModel);
    return CHAT_PROVIDER === "gemini"
        ? getGoogleProvider()(modelId)
        : getOpenAiProvider()(modelId);
}

/** @internal Test helper for clearing cached provider clients. */
export function resetAiModelCacheForTests(): void {
    googleProvider = null;
}
