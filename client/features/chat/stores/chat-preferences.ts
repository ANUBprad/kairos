"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CHAT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"] as const;
export type ChatModelId = (typeof CHAT_MODELS)[number];

export const CHAT_MODEL_LABELS: Record<ChatModelId, string> = {
    "gemini-3.6-flash": "Gemini 3.6 Flash",
    "gemini-3.5-flash-lite": "Gemini 3.5 Flash Lite",
};

export const DEFAULT_CHAT_MODEL: ChatModelId = "gemini-3.6-flash";

export type WorkspaceChatPrefs = {
    model: ChatModelId;
    webSearch: boolean;
};

export type ChatPreferencesState = {
    byWorkspace: Record<string, WorkspaceChatPrefs>;
    getPrefs: (
        workspaceId: string,
        defaultModel?: string,
    ) => WorkspaceChatPrefs;
    setModel: (workspaceId: string, model: ChatModelId) => void;
    setWebSearch: (workspaceId: string, enabled: boolean) => void;
};

export function resolveChatModel(model?: string): ChatModelId {
    if (model && CHAT_MODELS.includes(model as ChatModelId)) {
        return model as ChatModelId;
    }

    // Legacy gpt-* workspace defaults and persisted preferences map to Flash.
    return DEFAULT_CHAT_MODEL;
}

export const useChatPreferences = create<ChatPreferencesState>()(
    persist(
        (set, get) => ({
            byWorkspace: {},
            getPrefs: (workspaceId, defaultModel) => {
                const existing = get().byWorkspace[workspaceId];
                if (existing) {
                    return {
                        ...existing,
                        model: resolveChatModel(existing.model),
                    };
                }

                return {
                    model: resolveChatModel(defaultModel),
                    webSearch: false,
                };
            },
            setModel: (workspaceId, model) =>
                set((state) => ({
                    byWorkspace: {
                        ...state.byWorkspace,
                        [workspaceId]: {
                            ...state.getPrefs(workspaceId),
                            model,
                        },
                    },
                })),
            setWebSearch: (workspaceId, webSearch) =>
                set((state) => ({
                    byWorkspace: {
                        ...state.byWorkspace,
                        [workspaceId]: {
                            ...state.getPrefs(workspaceId),
                            webSearch,
                        },
                    },
                })),
        }),
        { name: "kairos-chat-preferences" },
    ),
);
