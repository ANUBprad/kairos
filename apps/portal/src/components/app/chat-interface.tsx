"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/app/kb-workspace-tabs";
import {
  Send,
  Square,
  Trash2,
  Plus,
  FileText,
  BookOpen,
  Check,
  ChevronDown,
  Loader2,
  RotateCcw,
  Sparkles,
  PanelLeft,
  X,
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
import { resolveStreamGate } from "@/lib/ai/chat/stream-gate";
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
  const [historyOpen, setHistoryOpen] = useState(true);
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

  // Grow the composer with its content up to ~5 lines, then scroll inside it,
  // so long questions stay readable without the box ever jumping height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

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

      // Fail fast on non-streaming responses: a 4xx/5xx body is not SSE and
      // parsing it would produce a blank assistant message. Surface the
      // server-provided error and stop; the finally block still resets the
      // streaming state and reloads the conversation list.
      const streamGate = await resolveStreamGate(res);
      if (!streamGate.streaming) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `**Error:** ${streamGate.error}` }
              : m,
          ),
        );
        return;
      }

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
    <div>
      <WorkspaceHeader
        kbId={kbId}
        kbName={kbName}
        title="Research"
        description="Ask questions and get grounded answers. Every answer cites the source chunks it draws from."
        active="research"
        className="mb-2"
      />

      <div className="relative flex h-[calc(100dvh-16rem)] min-h-[28rem] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        {historyOpen && (
          <div
            className="absolute inset-0 z-10 bg-text-primary/20 lg:hidden"
            onClick={() => setHistoryOpen(false)}
            aria-hidden="true"
          />
        )}

        {historyOpen && (
          <aside className="absolute inset-y-0 left-0 z-20 flex w-72 shrink-0 flex-col border-r border-border bg-surface lg:static lg:z-auto">
            <div className="flex items-center justify-between px-3 pb-2 pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                Conversations
              </p>
              <button
                onClick={() => setHistoryOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary lg:hidden"
                aria-label="Close conversation history"
              >
                <X size={15} />
              </button>
            </div>
            <div className="px-3 pb-2">
              <Button variant="primary" size="sm" className="w-full" onClick={createConversation}>
                <Plus size={14} />
                New research
              </Button>
            </div>
            <nav
              className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4"
              aria-label="Conversation history"
            >
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeConversation === conv.id
                      ? "bg-brand/10 text-brand"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveConversation(conv.id);
                      setHistoryOpen(false);
                    }}
                    aria-current={activeConversation === conv.id ? "true" : undefined}
                    className="min-w-0 flex-1 truncate text-left"
                  >
                    {conv.title || "Untitled research"}
                  </button>
                  <button
                    onClick={() => deleteConv(conv.id)}
                    className="shrink-0 text-text-tertiary opacity-0 transition-all hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete ${conv.title || "untitled research"}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-text-tertiary">
                  No research sessions yet
                </p>
              )}
            </nav>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
              aria-label={historyOpen ? "Hide conversation history" : "Show conversation history"}
              aria-expanded={historyOpen}
            >
              <PanelLeft size={16} />
            </button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
              {conversations.find((c) => c.id === activeConversation)?.title ?? "New research"}
            </h2>
            <span className="hidden shrink-0 text-xs text-text-tertiary sm:block">
              {documents.length} indexed source{documents.length === 1 ? "" : "s"}
            </span>
          </div>

          <div
            className="flex-1 overflow-y-auto"
            role="log"
            aria-label="Research messages"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <BookOpen size={24} className="mb-3 text-text-tertiary" />
                <h3 className="section-title">Ask your first question</h3>
                <p className="reading-measure page-description mt-2">
                  Every answer is grounded in your sources and cites the exact chunks it draws
                  from, so you can verify each claim against your documents.
                </p>
                {!activeConversation && (
                  <Button variant="primary" className="mt-6" onClick={createConversation}>
                    <Plus size={16} />
                    Start a research session
                  </Button>
                )}
              </div>
            ) : (
              <div className="reading-measure mx-auto space-y-8 px-4 py-5">
                {messages.map((msg) =>
                  msg.role === "user" ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-[var(--radius-lg)] rounded-br-sm bg-bg-secondary px-4 py-2.5 text-[15px] leading-relaxed text-text-primary">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id}>
                      <div className="prose-reading text-text-primary">
                        {msg.content ? (
                          <MarkdownRenderer content={msg.content} />
                        ) : isStreaming ? (
                          <p
                            className="flex items-center gap-2 text-sm text-text-tertiary"
                            role="status"
                          >
                            <Loader2 size={14} className="animate-spin" />
                            Searching your sources…
                          </p>
                        ) : null}
                      </div>

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-4 border-t border-border/70 pt-3">
                          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                            Sources
                          </p>
                          <ol className="space-y-2">
                            {msg.citations.map((c, i) => (
                              <li key={c.chunkId}>
                                <Link
                                  href={`/app/knowledge-bases/${kbId}/${c.documentId}?chunk=${c.chunkIndex}`}
                                  className="group flex gap-3 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                >
                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                                    {i + 1}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-text-primary group-hover:text-brand">
                                      <span className="max-w-[40ch] truncate">
                                        {c.documentName}
                                      </span>
                                      <span className="font-normal text-text-tertiary">
                                        chunk #{c.chunkIndex}
                                        {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
                                        {c.similarity
                                          ? ` · ${Math.round(c.similarity * 100)}%`
                                          : ""}
                                      </span>
                                    </span>
                                    {c.excerpt && (
                                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-text-secondary">
                                        {c.excerpt}
                                      </span>
                                    )}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {!isStreaming && turnSourceIds(msg).length > 0 && (
                        <div className="mt-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-text-tertiary hover:text-brand"
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

                      {isFailedMessage(msg) && !isStreaming && (
                        <div className="mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-text-tertiary hover:text-brand"
                            onClick={() => retryMessage(msg.id)}
                          >
                            <RotateCcw size={12} />
                            Try again
                          </Button>
                        </div>
                      )}
                    </div>
                  ),
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border p-3">
            <div className="mx-auto flex max-w-[72ch] items-end gap-2">
              <div className="relative shrink-0" ref={scopeRef}>
                <button
                  onClick={() => setScopeOpen((v) => !v)}
                  disabled={!activeConversation}
                  aria-label="Source scope"
                  aria-expanded={scopeOpen}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
                >
                  <BookOpen size={14} />
                  <span>{formatSourceScopeLabel(selectedSourceIds.length)}</span>
                  <ChevronDown
                    size={14}
                    className={scopeOpen ? "rotate-180 transition-transform" : "transition-transform"}
                  />
                </button>
                {scopeOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-hover">
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
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-hover"
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
                      <p className="px-2 py-3 text-center text-xs text-text-tertiary">
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
                placeholder={
                  activeConversation ? "Ask a question…" : "Start a research session first…"
                }
                disabled={!activeConversation || isStreaming}
                rows={1}
                aria-label="Research question"
                className="max-h-36 flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none disabled:opacity-40"
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
            <p className="mx-auto mt-2 hidden max-w-[72ch] text-[11px] text-text-tertiary sm:block">
              Enter to send · Shift + Enter for a new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
