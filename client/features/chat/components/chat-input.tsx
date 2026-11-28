"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Globe, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CircularLoader } from "@/components/ui/circular-loader";
import {
  CREDIT_COSTS,
  formatUtcInstant,
  useUsage,
  useUpgradeModal,
} from "@/features/billing";
import { enhanceChatPrompt } from "../lib/api";
import { toast } from "@/components/ui/toast";
import {
  CHAT_MODELS,
  CHAT_MODEL_LABELS,
  useChatPreferences,
  type ChatModelId,
} from "../stores/chat-preferences";

interface ChatInputProps {
  workspaceId: string;
  defaultModel?: string;
  onModelChange?: (model: string) => void;
  onSendMessage: (message: string) => void;
  onStopStreaming?: () => void;
  isStreaming: boolean;
  selectedSourcesCount: number;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
}

export function ChatInput({
  workspaceId,
  defaultModel,
  onModelChange,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  selectedSourcesCount,
  webSearchEnabled,
  onToggleWebSearch,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [promptBeforeEnhance, setPromptBeforeEnhance] = useState<string | null>(
    null,
  );
  const [isEnhancing, setIsEnhancing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    credits,
    windowCredits,
    paidCredits,
    nextCreditResetAt,
    bypassCredits,
  } = useUsage();
  const { openUpgradeModal } = useUpgradeModal();
  const currentModel = useChatPreferences(
    (state) => state.getPrefs(workspaceId, defaultModel).model,
  );
  const setStoredModel = useChatPreferences((state) => state.setModel);

  const isOutOfCredits =
    !bypassCredits && credits < CREDIT_COSTS.CHAT_MESSAGE;

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;

    if (isOutOfCredits) {
      const resetHint = nextCreditResetAt
        ? ` The next free-window reset is ${formatUtcInstant(nextCreditResetAt)}; paid top-ups never expire.`
        : " Paid top-ups never expire.";
      openUpgradeModal({
        reason: `You need at least ${CREDIT_COSTS.CHAT_MESSAGE} credit to send a chat message.${resetHint}`,
        limitType: "credits",
        requiredCredits: CREDIT_COSTS.CHAT_MESSAGE,
        currentCredits: credits,
      });
      return;
    }

    onSendMessage(input);
    setInput("");
    setPromptBeforeEnhance(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleEnhanceOrRevert = async () => {
    if (isEnhancing || isStreaming) return;

    if (promptBeforeEnhance !== null) {
      setInput(promptBeforeEnhance);
      setPromptBeforeEnhance(null);
      return;
    }

    const current = input.trim();
    if (!current) return;

    setIsEnhancing(true);
    try {
      const { enhanced } = await enhanceChatPrompt(
        workspaceId,
        current,
        selectedSourcesCount,
      );
      setPromptBeforeEnhance(current);
      setInput(enhanced);
    } catch (err) {
      toast.add({
        title: "Could not enhance prompt",
        description:
          err instanceof Error ? err.message : "Please try again.",
        type: "error",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleModelChange = (model: string) => {
    if (!(CHAT_MODELS as readonly string[]).includes(model)) return;
    const nextModel = model as ChatModelId;
    setStoredModel(workspaceId, nextModel);
    onModelChange?.(nextModel);
  };

  const showEnhanceControl =
    input.trim().length > 0 && !isStreaming && !isOutOfCredits;
  const isEnhanced = promptBeforeEnhance !== null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-panel px-3 py-2.5 sm:px-4">
      {/* Insufficient credits */}
      {isOutOfCredits && (
        <div
          role="status"
          className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-warning/25 bg-warning/5 px-2.5 py-1.5 text-[11px] text-foreground"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <Zap className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span className="truncate">
              No credits left ({windowCredits} free-window, {paidCredits} paid).
              Chats cost {CREDIT_COSTS.CHAT_MESSAGE} credit
              {nextCreditResetAt
                ? `; next reset ${formatUtcInstant(nextCreditResetAt)}`
                : ""}
              .
            </span>
          </div>
          <Button
            type="button"
            size="xs"
            variant="default"
            onClick={() =>
              openUpgradeModal({
                reason: `You need credits to send chat messages.${
                  nextCreditResetAt
                    ? ` Next free-window reset: ${formatUtcInstant(nextCreditResetAt)}.`
                    : ""
                } Paid top-ups never expire.`,
                limitType: "credits",
                requiredCredits: CREDIT_COSTS.CHAT_MESSAGE,
                currentCredits: credits,
              })
            }
            className="shrink-0 gap-1"
          >
            Top Up Credits
          </Button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-surface transition-colors focus-within:border-ring/70 focus-within:ring-1 focus-within:ring-ring/20 motion-reduce:transition-none"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (promptBeforeEnhance !== null) {
              setPromptBeforeEnhance(null);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isOutOfCredits
              ? "Top up your credits to send messages..."
              : selectedSourcesCount > 0
                ? "Ask a question about your selected sources..."
                : "Ask anything, or add sources to ground your chat..."
          }
          rows={1}
          disabled={isStreaming || isOutOfCredits}
          aria-label="Chat message"
          className="block w-full resize-none bg-transparent px-3 pb-1 pt-2.5 font-sans text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <label className="relative inline-flex min-w-0 items-center rounded-md border border-border bg-muted pl-2 pr-1 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/20">
              <span className="sr-only">Chat model</span>
              <select
                aria-label="Chat model"
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="max-w-32 appearance-none bg-transparent py-1 pr-4 text-[11px] font-medium text-foreground focus:outline-none"
              >
                {CHAT_MODELS.map((id) => (
                  <option key={id} value={id}>
                    {CHAT_MODEL_LABELS[id]}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-1 size-3 text-muted-foreground"
                aria-hidden="true"
              />
            </label>

            <button
              type="button"
              onClick={onToggleWebSearch}
              title="Toggle Tavily live web search"
              aria-pressed={webSearchEnabled}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
                webSearchEnabled
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface text-muted-foreground hover:bg-brand-quiet hover:text-foreground",
              )}
            >
              <Globe className="size-3" aria-hidden="true" />
              <span>Web search</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isEnhancing && (
              <div
                role="status"
                aria-label="Enhancing prompt"
                aria-busy="true"
                className="flex size-7 items-center justify-center rounded-md border border-border bg-muted text-brand"
              >
                <CircularLoader size={13} className="motion-reduce:animate-none" />
              </div>
            )}

            {showEnhanceControl && !isEnhancing && (
              <button
                type="button"
                onClick={() => void handleEnhanceOrRevert()}
                title={
                  isEnhanced
                    ? "Restore your original prompt"
                    : "Improve clarity with Gemini"
                }
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
                  isEnhanced
                    ? "bg-brand-soft text-brand hover:bg-brand-soft/80"
                    : "text-muted-foreground hover:text-brand",
                )}
              >
                {isEnhanced ? "Revert" : "Enhance prompt"}
              </button>
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                title="Stop generating"
                aria-label="Stop generating"
                className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background transition-colors hover:opacity-90 motion-reduce:transition-none"
              >
                <span
                  className="size-2.5 rounded-sm bg-background"
                  aria-hidden="true"
                />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isOutOfCredits}
                title={
                  isOutOfCredits
                    ? "Top up credits to send messages"
                    : `Send message (${CREDIT_COSTS.CHAT_MESSAGE} credit)`
                }
                aria-label="Send message"
                className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              >
                <ArrowUp className="size-4 stroke-[2.5]" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
