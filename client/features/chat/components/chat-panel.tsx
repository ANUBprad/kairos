"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ChatMessage as ChatMessageType, Conversation } from "../types";
import {
  MessageSquare,
  Plus,
  Trash2,
  HelpCircle,
  BookOpen,
  FileSearch,
  ChevronDown,
  Check,
  ArrowUp,
} from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { scrollBehavior } from "@/lib/scroll";
import { useReducedMotion } from "motion/react";

type ChatConfirmAction = "clear" | "delete" | null;

interface ChatPanelProps {
  workspaceId: string;
  defaultModel?: string;
  onModelChange?: (model: string) => void;
  messages: ChatMessageType[];
  isStreaming: boolean;
  onSendMessage: (message: string) => void;
  onStopStreaming?: () => void;
  onNewChat: () => void;
  selectedSourcesCount: number;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void | Promise<void>;
  onClearConversation: (id: string) => void | Promise<void>;
}

const STARTER_PROMPTS = [
  {
    icon: <BookOpen className="size-3.5 text-brand" aria-hidden="true" />,
    title: "Summarize sources",
    desc: "Key concepts across your selected sources",
    prompt:
      "Please provide a comprehensive and detailed summary of all key concepts across my selected sources.",
  },
  {
    icon: <FileSearch className="size-3.5 text-brand" aria-hidden="true" />,
    title: "Key takeaways & insights",
    desc: "Five takeaways with supporting evidence",
    prompt:
      "What are the top 5 most important takeaways and insights from these documents? Explain each clearly.",
  },
  {
    icon: <HelpCircle className="size-3.5 text-brand" aria-hidden="true" />,
    title: "Find connections",
    desc: "Shared themes and contrasting arguments",
    prompt:
      "Analyze the connections, common themes, and contrasting viewpoints across my sources.",
  },
];

export function ChatPanel({
  workspaceId,
  defaultModel,
  onModelChange,
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onNewChat,
  selectedSourcesCount,
  webSearchEnabled,
  onToggleWebSearch,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onClearConversation,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isConvMenuOpen, setIsConvMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ChatConfirmAction>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const convMenuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Auto-scroll to bottom as messages stream. An explicit smooth behavior
  // overrides the CSS reduced-motion rule, so choose it from the preference.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: scrollBehavior(reduceMotion),
    });
  }, [messages, isStreaming, reduceMotion]);

  // Track scroll position for go-to-top button
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 150);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: scrollBehavior(reduceMotion),
    });
  };

  const closeConfirmDialog = () => {
    setConfirmAction(null);
    setPendingDeleteId(null);
  };

  const handleConfirmAction = async () => {
    if (confirmAction === "clear") {
      if (currentConversationId) {
        await onClearConversation(currentConversationId);
      } else {
        onNewChat();
      }
    } else if (confirmAction === "delete" && pendingDeleteId) {
      await onDeleteConversation(pendingDeleteId);
      setIsConvMenuOpen(false);
    }
    closeConfirmDialog();
  };

  // Click outside to close conversation menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (convMenuRef.current && !convMenuRef.current.contains(e.target as Node)) {
        setIsConvMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentConv = conversations.find((c) => c.id === currentConversationId);

  return (
    <div className="relative flex h-full select-text flex-col bg-panel text-foreground">
      {/* Chat sub-header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-panel/85 px-3 py-2 backdrop-blur-sm sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <MessageSquare className="hidden size-4 shrink-0 text-brand sm:block" aria-hidden="true" />
          <span className="kairos-eyebrow hidden shrink-0 sm:inline">
            Chat
          </span>

          {/* Conversation selector */}
          <div
            className="relative min-w-0 max-w-[200px] flex-1 sm:max-w-[240px]"
            ref={convMenuRef}
          >
            <button
              type="button"
              onClick={() => setIsConvMenuOpen(!isConvMenuOpen)}
              aria-expanded={isConvMenuOpen}
              aria-label="Choose conversation"
              className="flex w-full items-center justify-between gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-brand-soft/70 motion-reduce:transition-none"
            >
              <span className="truncate text-left">
                {currentConv ? currentConv.title || "Untitled Chat" : "+ New Conversation"}
              </span>
              <ChevronDown
                className={cn(
                  "size-3 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  isConvMenuOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>

            {isConvMenuOpen && (
              <div className="kairos-panel absolute left-0 top-full z-40 mt-1.5 w-64 space-y-0.5 p-1 text-xs sm:w-72">
                <button
                  type="button"
                  onClick={() => {
                    setIsConvMenuOpen(false);
                    onNewChat();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    !currentConversationId
                      ? "bg-brand-soft font-semibold text-brand"
                      : "text-foreground hover:bg-brand-quiet",
                  )}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>New Conversation</span>
                </button>

                {conversations.length > 0 && (
                  <div className="max-h-48 space-y-0.5 overflow-y-auto border-t border-border pt-1">
                    {conversations.map((c) => {
                      const isActive = c.id === currentConversationId;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "group flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 transition-colors",
                            isActive
                              ? "bg-brand-soft font-semibold text-brand"
                              : "text-foreground hover:bg-brand-quiet",
                          )}
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            onSelectConversation(c.id);
                          }}
                        >
                          <span className="flex-1 truncate text-xs">
                            {c.title || "Untitled Chat"}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {isActive && (
                              <Check className="size-3.5 text-foreground" aria-hidden="true" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDeleteId(c.id);
                                setConfirmAction("delete");
                              }}
                              title="Delete chat"
                              aria-label={`Delete ${c.title || "untitled chat"}`}
                              className="rounded p-1 text-muted-foreground opacity-100 transition-colors hover:text-danger focus-visible:opacity-100 motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                            >
                              <Trash2 className="size-3" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {(currentConversationId || messages.length > 0) && (
            <button
              type="button"
              onClick={() => setConfirmAction("clear")}
              title="Clear all messages in this chat"
              aria-label="Clear chat messages"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger motion-reduce:transition-none"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewChat}
            aria-label="Start a new chat"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-brand-soft/70 motion-reduce:transition-none"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-2 py-6 text-center">
              <KairosLogo size={36} showText={false} iconClassName="text-brand" />

              <div className="space-y-1">
                <span className="kairos-eyebrow">Grounded chat</span>
                <h3 className="kairos-section-title text-base text-foreground sm:text-lg">
                  Ask anything about your notes &amp; sources
                </h3>
                <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                  Kairos retrieves relevant excerpts from your indexed materials
                  and answers with source citations.
                </p>
              </div>

              <div className="w-full divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {STARTER_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendMessage(item.prompt)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-brand-quiet motion-reduce:transition-none"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-quiet">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {item.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage
                key={message.id || index}
                message={message}
                isLast={index === messages.length - 1}
                isStreaming={isStreaming}
              />
            ))
          )}

          <div ref={messagesEndRef} />
        </div>

        {showScrollTop && messages.length > 0 && (
          <button
            type="button"
            onClick={scrollToTop}
            title="Go to top"
            aria-label="Scroll to top of chat"
            className="absolute bottom-3 right-3 z-20 flex size-7 items-center justify-center rounded-md border border-border bg-panel text-brand transition-colors hover:bg-brand-soft motion-reduce:transition-none"
          >
            <ArrowUp className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <ChatInput
        workspaceId={workspaceId}
        defaultModel={defaultModel}
        onModelChange={onModelChange}
        onSendMessage={onSendMessage}
        onStopStreaming={onStopStreaming}
        isStreaming={isStreaming}
        selectedSourcesCount={selectedSourcesCount}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={onToggleWebSearch}
      />

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeConfirmDialog();
          }
        }}
      >
        <AlertDialogContent size="default" className="sm:max-w-md">
          <AlertDialogHeader className="text-left place-items-start">
            <AlertDialogTitle>
              {confirmAction === "delete"
                ? "Delete conversation?"
                : "Clear chat messages?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "delete"
                ? "This will permanently remove this conversation and all of its messages. This cannot be undone."
                : "All messages in this chat will be removed. The conversation will stay in your history so you can start fresh."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmAction()}
            >
              {confirmAction === "delete" ? "Delete" : "Clear messages"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
