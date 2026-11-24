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
    icon: <BookOpen className="w-4 h-4 text-brand" />,
    title: "Summarize sources",
    desc: "Provide a comprehensive summary of all key concepts across my selected sources.",
    prompt:
      "Please provide a comprehensive and detailed summary of all key concepts across my selected sources.",
  },
  {
    icon: <FileSearch className="w-4 h-4 text-brand" />,
    title: "Key takeaways & insights",
    desc: "Extract the top 5 most important takeaways with supporting evidence.",
    prompt:
      "What are the top 5 most important takeaways and insights from these documents? Explain each clearly.",
  },
  {
    icon: <HelpCircle className="w-4 h-4 text-brand" />,
    title: "Find connections",
    desc: "What are the common themes and contrasting arguments across these documents?",
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

  // Auto-scroll to bottom as messages stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Track scroll position for go-to-top button
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 150);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
      {/* Top Chat Sub-header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-panel/85 px-3 py-2.5 backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <MessageSquare className="hidden size-4 shrink-0 text-brand sm:block" />
          <span className="kairos-eyebrow hidden shrink-0 sm:inline">
            Chat
          </span>

          {/* Custom Compact Conversation Selector Dropdown */}
          <div className="relative min-w-0 flex-1 max-w-[200px] sm:max-w-[240px]" ref={convMenuRef}>
            <button
              type="button"
              onClick={() => setIsConvMenuOpen(!isConvMenuOpen)}
              aria-expanded={isConvMenuOpen}
              aria-label="Choose conversation"
              className="flex w-full items-center justify-between gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-brand-soft/70 motion-reduce:transition-none"
            >
              <span className="truncate text-left">
                {currentConv ? currentConv.title || "Untitled Chat" : "+ New Conversation"}
              </span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 text-muted-foreground shrink-0 transition-transform duration-200",
                  isConvMenuOpen && "rotate-180"
                )}
              />
            </button>

            {isConvMenuOpen && (
              <div className="kairos-panel absolute left-0 top-full z-40 mt-1.5 w-64 space-y-1 p-1.5 text-xs motion-safe:animate-fadeIn sm:w-72">
                <button
                  type="button"
                  onClick={() => {
                    setIsConvMenuOpen(false);
                    onNewChat();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer",
                    !currentConversationId
                      ? "bg-brand-soft font-semibold text-brand"
                      : "text-foreground hover:bg-brand-quiet"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Conversation</span>
                </button>

                {conversations.length > 0 && (
                  <div className="pt-1 border-t border-border max-h-52 overflow-y-auto space-y-0.5">
                    {conversations.map((c) => {
                      const isActive = c.id === currentConversationId;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg group transition-colors cursor-pointer",
                            isActive
                              ? "bg-brand-soft font-semibold text-brand"
                              : "text-foreground hover:bg-brand-quiet"
                          )}
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            onSelectConversation(c.id);
                          }}
                        >
                          <span className="truncate flex-1 text-xs">{c.title || "Untitled Chat"}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isActive && <Check className="w-3.5 h-3.5 text-foreground" />}
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
                              <Trash2 className="w-3 h-3" />
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

        {/* Header Action Buttons: Clear, New Chat */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(currentConversationId || messages.length > 0) && (
            <button
              type="button"
              onClick={() => setConfirmAction("clear")}
              title="Clear all messages in this chat"
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger motion-reduce:transition-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Clear</span>
            </button>
          )}

          {/* New Chat Button */}
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-brand-soft/70 motion-reduce:transition-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 md:p-7"
        >
          {messages.length === 0 ? (
            <div className="kairos-aurora mx-auto flex h-full max-w-lg flex-col items-center justify-center space-y-6 text-center motion-safe:animate-fadeIn">
              <div
                aria-hidden="true"
                className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-56 opacity-40"
              />
              <KairosLogo size={58} showText={false} iconClassName="text-brand" />

              <div className="space-y-2">
                <span className="kairos-eyebrow">Grounded chat</span>
                <h3 className="kairos-section-title text-xl text-foreground sm:text-2xl">
                  Ask anything about your notes &amp; sources
                </h3>
                <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Kairos retrieves relevant excerpts directly from your indexed
                  materials and synthesizes answers with source citations.
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid w-full grid-cols-1 gap-2.5 pt-2">
                {STARTER_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(item.prompt)}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 text-left shadow-[var(--shadow-panel)] transition-colors hover:border-brand/35 hover:bg-brand-quiet motion-reduce:transition-none"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-brand-quiet transition-colors group-hover:bg-brand-soft motion-reduce:transition-none">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {item.prompt}
                      </p>
                    </div>
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

        {/* Go To Top Floating Button at Bottom Right */}
        {showScrollTop && messages.length > 0 && (
          <button
            type="button"
            onClick={scrollToTop}
            className="absolute bottom-3 right-4 z-20 flex size-8 items-center justify-center rounded-full border border-brand/25 bg-panel/95 text-brand shadow-[var(--shadow-panel)] backdrop-blur-sm transition-colors hover:bg-brand-soft motion-safe:animate-fadeIn motion-reduce:transition-none"
            title="Go to top"
            aria-label="Scroll to top of chat"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </div>


      {/* Input Bar */}
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
