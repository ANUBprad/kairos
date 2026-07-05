"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Square,
  Trash2,
  Plus,
  MessageSquare,
  Bot,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
}

export function ChatInterface({ kbId, kbName }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
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

  const handleSubmit = async () => {
    const query = input.trim();
    if (!query || !activeConversation || isStreaming) return;

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
            }
          } catch {
            // skip malformed SSE
          }
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
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || (msg.role === "assistant" && isStreaming ? "..." : "")}
                  </ReactMarkdown>
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                      Sources
                    </p>
                    <div className="space-y-1.5">
                      {msg.citations.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-lg bg-bg/50 p-2 text-xs"
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
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
