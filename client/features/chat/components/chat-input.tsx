"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Globe, Zap, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUsage, useUpgradeModal } from "@/features/billing";
import { enhanceChatPrompt } from "../lib/api";
import { toast } from "@/components/ui/toast";


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
  const { credits } = useUsage();
  const { openUpgradeModal } = useUpgradeModal();

  const isOutOfCredits = credits < 1;

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
      openUpgradeModal({
        reason: "You need at least 1 credit to send a chat message. Please top up your balance.",
        limitType: "credits",
        requiredCredits: 1,
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
    <div className="space-y-2 border-t border-border bg-panel/80 p-3.5 backdrop-blur-sm sm:p-4">
      {/* Insufficient credits banner */}
      {isOutOfCredits && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-xs font-medium text-foreground motion-safe:animate-fadeIn">
          <div className="flex items-center gap-2">
            <Zap className="size-4 shrink-0 text-warning" />
            <span>
              You have 0 credits remaining. Chats cost 1 credit each.
            </span>
          </div>
          <Button
            type="button"
            size="xs"
            variant="default"
            onClick={() =>
              openUpgradeModal({
                reason: "You need credits to send chat messages. Top up your balance to continue.",
                limitType: "credits",
                requiredCredits: 1,
                currentCredits: credits,
              })
            }
            className="gap-1 text-xs font-semibold shadow-[var(--shadow-panel)]"
          >
            Top Up Credits
          </Button>
        </div>
      )}


      <div
        className={cn(
          "rounded-2xl p-[1.5px] transition-colors duration-300 motion-reduce:transition-none",
          isEnhancing
            ? "bg-brand/50 shadow-[var(--shadow-lift)]"
            : "bg-border focus-within:bg-brand/50 has-[:focus]:bg-brand/50",
        )}
      >
      <form
        onSubmit={handleSubmit}
        className="relative space-y-2.5 rounded-[calc(1rem-1px)] bg-panel p-3 shadow-[var(--shadow-panel)]"
      >
        {/* Text input area */}
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
              ? `Ask a question about your selected sources...`
              : "Ask anything, or add sources to ground your chat..."
          }
          rows={1}
          disabled={isStreaming || isOutOfCredits}
          aria-label="Chat message"
          className="w-full resize-none bg-transparent font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {/* Web search toggle */}
            <button
              type="button"
              onClick={onToggleWebSearch}
              title="Toggle Tavily live web search"
              aria-pressed={webSearchEnabled}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
                webSearchEnabled
                  ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-panel)]"
                  : "border-border bg-brand-soft/60 text-brand hover:bg-brand-soft"
              )}
            >
              <Globe className="w-3 h-3" />
              <span>Web search</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isEnhancing && (
              <div
                className="flex size-8 items-center justify-center rounded-full border border-border bg-brand-soft"
                aria-label="Enhancing prompt"
                aria-busy="true"
              >
                <LoaderCircle className="size-4 text-brand motion-safe:animate-spin" />
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
                  "rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
                  isEnhanced
                    ? "bg-brand-soft text-brand hover:bg-brand-soft/80"
                    : "bg-transparent text-muted-foreground hover:text-brand",
                )}
              >
                {isEnhanced ? "Revert" : "Enhance prompt"}
              </button>
            )}

          {/* Submit / Stop button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              title="Stop generating"
              className="flex size-8 items-center justify-center rounded-full bg-foreground text-background shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 motion-reduce:transition-none"
            >
              <span className="w-2.5 h-2.5 rounded-[2px] bg-background" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isOutOfCredits}
              title={isOutOfCredits ? "Top up credits to send messages" : "Send message (1 credit)"}
              className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}

