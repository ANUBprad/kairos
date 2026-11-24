"use client";

import React, { useState } from "react";
import { ChatMessage as ChatMessageType } from "../types";
import { Copy, Check } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { StreamingResponse } from "@/components/agents/streaming-response";
import { ReasoningText } from "@/components/agents/loading-states/reasoning-text";
import { ChatMarkdown } from "@/components/ui/chat-markdown";
import { chatCitationsToAgentItems } from "../lib/citation-items";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";

interface ChatMessageProps {
  message: ChatMessageType;
  isLast?: boolean;
  isStreaming?: boolean;
}

export function ChatMessage({
  message,
  isLast,
  isStreaming,
}: ChatMessageProps) {
  const { data: session } = useSession();
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(
    null,
  );
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format content with full markdown & code blocks
  const renderFormattedContent = (content: string) => {
    if (!content) {
      if (!isUser && isLast && isStreaming) {
        return (
          <ReasoningText
            variant="cascade"
            phrases={[
              "Thinking",
              "Reading the request",
              "Working through the details",
              "Preparing the answer",
            ]}
            className="py-1"
          />
        );
      }
      return null;
    }

    if (isUser) {
      return (
        <div className="space-y-2 leading-relaxed whitespace-pre-wrap font-sans text-sm text-foreground select-text cursor-text">
          {content}
        </div>
      );
    }

    const responseStatus =
      isLast && isStreaming ? "streaming" : "complete";
    const sourceItems = chatCitationsToAgentItems(message.citations);

    const handleCitationActivate = (citationId: string) => {
      setHighlightedSourceId(citationId);
      setSourcesOpen(true);
      requestAnimationFrame(() => {
        const el = document.getElementById(
          `response-source-${citationId}`,
        );
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    };

    return (
      <StreamingResponse
        status={responseStatus}
        copyText={content}
        sources={sourceItems}
        sourcesOpen={sourcesOpen}
        onSourcesOpenChange={setSourcesOpen}
        highlightedSourceId={highlightedSourceId}
        sourceIdPrefix="response-source"
        announce={responseStatus === "streaming"}
        showActions={true}
      >
        <ChatMarkdown
          content={content}
          isStreaming={responseStatus === "streaming"}
          citations={message.citations ?? undefined}
          onCitationActivate={handleCitationActivate}
        />
      </StreamingResponse>
    );
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-2xl border p-3.5 transition-colors motion-reduce:transition-none sm:gap-3.5 sm:p-4",
        isUser
          ? "ml-auto max-w-[88%] border-brand/25 bg-brand-soft/70 text-foreground"
          : "mr-auto max-w-[94%] border-border bg-panel text-foreground"
      )}
    >
      {/* Role Avatar Icon */}
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-[var(--shadow-panel)]",
          isUser
            ? "border-foreground/15 bg-foreground text-background"
            : "border-brand/20 bg-brand-quiet text-brand"
        )}
      >
        {isUser ? (
          <UserAvatar
            src={session?.user?.image}
            name={session?.user?.name}
            className="rounded-lg"
            fallbackClassName="rounded-lg"
          />
        ) : (
          <KairosLogo size={22} showText={false} />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="kairos-eyebrow">
            {isUser ? "You" : "Kairos"}
          </span>

          {isUser && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy message"
              aria-label={copied ? "Copied message" : "Copy message"}
              className="rounded p-1 text-muted-foreground opacity-100 transition-colors hover:text-brand focus-visible:opacity-100 motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        <div>{renderFormattedContent(message.content)}</div>
      </div>
    </div>
  );
}
