"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send,
  Square,
  Trash2,
  Plus,
  MessageSquare,
  Bot,
  FileText,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { formatSourceScopeLabel, MAX_CHAT_SOURCES } from "@/lib/ai/chat/source-scope";
import {
  ACTIVE_STUDIO_ARTIFACT_TYPES,
  ARTIFACT_TYPE_META,
} from "@/components/app/studio/artifact-type-meta";
import type { ActiveStudioArtifactType } from "@/components/app/studio/artifact-type-meta";
import {
  generateSummaryArtifact,
  generateReportArtifact,
  generateQuizArtifact,
  generateFlashcardsArtifact,
  generateMindmapArtifact,
  generateTakeawaysArtifact,
  generatePodcastArtifact,
} from "@/lib/actions/artifacts";
import {
  GENERATION_FAILED_TEXT,
  GENERATION_STOPPED_TEXT,
} from "@/lib/ai/chat/stream-markers";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Citation {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number | null;
  excerpt: string;
  similarity: number;
}



interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface Conversation {
  id: string;
  title: string | null;
  model: string;
  provider: string;
  createdAt: string;
}

interface Props {
  kbId: string;
  kbName: string;
  documents: { id: string; name: string }[];
  initialConversationId?: string | null;
}

export function ChatInterface({ kbId, kbName, documents, initialConversationId = null }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [artifactMenuFor, setArtifactMenuFor] = useState<string | null>(null);
  const [generatingArtifactFor, setGeneratingArtifactFor] = useState<{
    msgId: string;
    type: ActiveStudioArtifactType;
  } | null>(null);
  const [createdArtifact, setCreatedArtifact] = useState<{
    msgId: string;
    type: ActiveStudioArtifactType;
    id: string;
  } | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/conversations?kbId=${kbId}`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      // ignore
    }
  }, [kbId]);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`);
      const data = await res.json();
      if (data.conversation) {
        setMessages(
          (data.conversation.messages || []).map((m: Message, i: number) => ({
            ...m,
            id: `msg-${i}`,
          })),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation);
    }
  }, [activeConversation, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!scopeOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) {
        setScopeOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [scopeOpen]);

  const toggleSource = (docId: string) => {
    setSelectedSourceIds((prev) => {
      const has = prev.includes(docId);
      if (has) return prev.filter((id) => id !== docId);
      if (prev.length >= MAX_CHAT_SOURCES) return prev;
      return [...prev, docId];
    });
  };

  const createConversation = async () => {
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kbId,
          title: `Chat about ${kbName}`,
        }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConversation(data.conversation.id);
        setMessages([]);
      }
    } catch {
      // ignore
    }
  };

  const deleteConv = async (id: string) => {
    try {
      await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversation === id) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch {
      // ignore
    }
  };

  // Exactly the seven studio generation actions; the engine re-validates the
  // session, the KB tenant boundary and every cited source before persisting.
  const ARTIFACT_GENERATORS: Readonly<
    Record<
      ActiveStudioArtifactType,
      (kbId: string, sourceIds: string[], name?: string) => Promise<LearningArtifactData>
    >
  > = {
    SUMMARY: generateSummaryArtifact,
    REPORT: generateReportArtifact,
    QUIZ: generateQuizArtifact,
    FLASHCARDS: generateFlashcardsArtifact,
    MINDMAP: generateMindmapArtifact,
    TAKEAWAYS: generateTakeawaysArtifact,
    PODCAST: generatePodcastArtifact,
  };

  // The source scope for a one-click artifact is the set of documents the
  // assistant turn actually cited; never the whole KB.
  const turnSourceIds = (msg: Message): string[] =>
    msg.citations ? [...new Set(msg.citations.map((c) => c.documentId))] : [];

  const generateArtifactFromTurn = async (
    msgId: string,
    type: ActiveStudioArtifactType,
    sourceIds: string[],
  ) => {
    if (generatingArtifactFor) return;
    setGeneratingArtifactFor({ msgId, type });
    setArtifactError(null);
    try {
      const artifact = await ARTIFACT_GENERATORS[type](kbId, sourceIds);
      setCreatedArtifact({ msgId, type, id: artifact.id });
      setArtifactMenuFor(null);
    } catch (err) {
      setArtifactError(err instanceof Error ? err.message : "Artifact generation failed");
    } finally {
      setGeneratingArtifactFor(null);
    }
  };

  const isFailedMessage = (msg: Message) =>
    msg.role === "assistant" &&
    (msg.content === GENERATION_FAILED_TEXT ||
      msg.content === GENERATION_STOPPED_TEXT ||
      msg.content.endsWith("\n\n_Generation stopped._"));

  const sendTurn = useCallback(async (query: string) => {
    if (!query || !activeConversation || isStreaming) return;
    const needsRename =
      conversations.find((c) => c.id === activeConversation)?.title ===
      `Chat about ${kbName}`;
    setInput("");
    setIsStreaming(true);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    };
    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation,
          kbId,
          query,
          sourceIds: selectedSourceIds,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === "chunk") {
              fullContent += data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
                ),
              );
            } else if (data.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: `**Error:** ${data.content}` }
                    : m,
                ),
              );
            } else if (data.type === "citations") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, citations: data.citations }
                    : m,
                ),
              );
            }
          } catch {
            // skip malformed SSE
          }
        }
      }

      if (needsRename) {
        const newTitle = query.slice(0, 60).trim();
        if (newTitle) {
          await fetch(`/api/ai/conversations/${activeConversation}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          });
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "**Error:** Failed to get response" }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      loadConversations();
    }
  }, [activeConversation, isStreaming, selectedSourceIds, conversations, kbId, kbName, loadConversations]);

  const handleSubmit = useCallback(() => {
    sendTurn(input.trim());
  }, [sendTurn, input]);

  const retryMessage = useCallback(
    (msgId: string) => {
      const idx = messages.findIndex((m) => m.id === msgId);
      if (idx < 1) return;
      const userMsg = messages[idx - 1];
      if (userMsg.role !== "user") return;
      sendTurn(userMsg.content);
    },
    [messages, sendTurn],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6 overflow-hidden">
      {showSidebar && (
        <div className="w-64 shrink-0 border-r border-border bg-surface overflow-y-auto">
          <div className="p-3">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={createConversation}
            >
              <Plus size={14} />
              New chat
            </Button>
          </div>
          <div className="space-y-0.5 px-2 pb-4">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                  activeConversation === conv.id
                    ? "bg-brand/10 text-brand"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`}
                onClick={() => setActiveConversation(conv.id)}
              >
                <MessageSquare size={14} className="shrink-0" />
                <span className="truncate flex-1">{conv.title || "Chat"}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv(conv.id);
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error transition-all"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="px-3 py-4 text-xs text-text-tertiary text-center">
                No conversations yet
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            aria-label={showSidebar ? "Collapse sidebar" : "Expand sidebar"}
          >
            {showSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <h2 className="text-sm font-medium text-text-primary truncate">
            {kbName} — AI Chat
          </h2>
          <Link
            href={`/app/knowledge-bases/${kbId}/studio`}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Sparkles size={12} />
            Studio
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-label="Chat messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot size={40} className="text-text-tertiary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Chat with {kbName}
              </h3>
              <p className="text-sm text-text-secondary max-w-md">
                Ask questions about your documents. The AI will search your knowledge base and provide answers with citations.
              </p>
              {!activeConversation && (
                <Button variant="primary" className="mt-6" onClick={createConversation}>
                  <Plus size={16} />
                  Start a conversation
                </Button>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-brand text-white"
                    : "bg-surface border border-border"
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none">
                  <MarkdownRenderer content={msg.content || (msg.role === "assistant" && isStreaming ? "..." : "")} />
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                      Sources
                    </p>
                    <div className="space-y-1.5">
                      {msg.citations.map((c) => (
                        <Link
                          key={c.chunkId}
                          href={`/app/knowledge-bases/${kbId}/${c.documentId}?chunk=${c.chunkIndex}`}
                          className="flex items-start gap-2 rounded-lg bg-bg/50 p-2 text-xs transition-colors hover:bg-surface-hover"
                        >
                          <FileText size={12} className="shrink-0 mt-0.5 text-text-tertiary" />
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">
                              {c.documentName}
                            </p>
                            <p className="text-text-tertiary">
                              Chunk #{c.chunkIndex}
                              {c.pageNumber && ` · Page ${c.pageNumber}`}
                              {c.similarity && ` · ${Math.round(c.similarity * 100)}% match`}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {msg.role === "assistant" && !isStreaming && turnSourceIds(msg).length > 0 && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setArtifactError(null);
                          setArtifactMenuFor(artifactMenuFor === msg.id ? null : msg.id);
                        }}
                        disabled={generatingArtifactFor?.msgId === msg.id}
                        aria-expanded={artifactMenuFor === msg.id}
                        aria-label={`Create an artifact from this answer (${turnSourceIds(msg).length} cited sources)`}
                      >
                        {generatingArtifactFor?.msgId === msg.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        Create artifact
                      </Button>
                      {createdArtifact && createdArtifact.msgId === msg.id && (
                        <span className="inline-flex items-center gap-1 text-xs text-text-primary">
                          <Check size={12} className="text-brand" />
                          {ARTIFACT_TYPE_META[createdArtifact.type].label} created
                        </span>
                      )}
                      {createdArtifact && createdArtifact.msgId === msg.id && (
                        <Link
                          href={`/app/knowledge-bases/${kbId}/artifacts/${createdArtifact.id}${
                            activeConversation ? `?conversation=${activeConversation}` : ""
                          }`}
                          className="text-xs font-medium text-brand transition-colors hover:underline"
                        >
                          View artifact
                        </Link>
                      )}
                    </div>

                    {artifactMenuFor === msg.id && (
                      <div className="mt-2 rounded-lg border border-border bg-bg p-1">
                        {ACTIVE_STUDIO_ARTIFACT_TYPES.map((type) => {
                          const meta = ARTIFACT_TYPE_META[type];
                          const busy =
                            generatingArtifactFor?.msgId === msg.id &&
                            generatingArtifactFor.type === type;
                          const count = turnSourceIds(msg).length;
                          return (
                            <button
                              key={type}
                              disabled={!!generatingArtifactFor}
                              onClick={() =>
                                generateArtifactFromTurn(msg.id, type, turnSourceIds(msg))
                              }
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 size={12} className="shrink-0 animate-spin" />
                              ) : (
                                <meta.Icon size={12} className="shrink-0" />
                              )}
                              <span className="flex-1 text-left">{meta.label}</span>
                              <span className="text-[10px] font-normal text-text-tertiary">
                                {count} source{count !== 1 ? "s" : ""}
                              </span>
                            </button>
                          );
                        })}
                        {artifactError && (
                          <p role="alert" className="px-3 py-2 text-xs text-error">
                            {artifactError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {msg.role === "assistant" && isFailedMessage(msg) && !isStreaming && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => retryMessage(msg.id)}
                    >
                      <RotateCcw size={12} />
                      Try again
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-4">
          <div className="flex gap-2 max-w-4xl mx-auto items-end">
            <div className="relative shrink-0" ref={scopeRef}>
              <button
                onClick={() => setScopeOpen((v) => !v)}
                disabled={!activeConversation}
                aria-label="Source scope"
                aria-expanded={scopeOpen}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
              >
                <BookOpen size={14} />
                <span>{formatSourceScopeLabel(selectedSourceIds.length)}</span>
                <ChevronDown size={14} className={scopeOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {scopeOpen && (
                <div className="absolute bottom-full left-0 mb-2 z-20 w-72 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg p-2">
                  <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSourceIds.length === 0}
                      onChange={() => setSelectedSourceIds([])}
                      className="accent-brand"
                    />
                    <span className="text-text-primary">All sources</span>
                  </label>
                  {documents.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-hover cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.includes(doc.id)}
                        onChange={() => toggleSource(doc.id)}
                        className="accent-brand"
                      />
                      <FileText size={12} className="shrink-0 text-text-tertiary" />
                      <span className="truncate text-text-primary">{doc.name}</span>
                    </label>
                  ))}
                  {documents.length === 0 && (
                    <p className="px-2 py-3 text-xs text-text-tertiary text-center">
                      No indexed documents yet
                    </p>
                  )}
                </div>
              )}
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeConversation ? "Ask a question..." : "Start a conversation first..."}
              disabled={!activeConversation || isStreaming}
              rows={1}
              aria-label="Chat message input"
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:border-brand disabled:opacity-40"
            />
            {isStreaming ? (
              <Button
                variant="secondary"
                onClick={stopGeneration}
                title="Stop"
                aria-label="Stop generation"
              >
                <Square size={16} />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!input.trim() || !activeConversation}
                aria-label="Send message"
              >
                <Send size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
