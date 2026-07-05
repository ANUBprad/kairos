"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Square,
  Plus,
  MessageSquare,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Search,
  Eye,
  Copy,
  Terminal,
  GitBranch,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

interface PipelineChunk {
  id: string;
  content: string;
  index: number;
  tokenCount: number | null;
  documentId: string;
  documentName: string;
  similarity: number;
  pageNumber: number | null;
  chunkSize: number;
}

interface PipelineStep {
  name: string;
  description: string;
  durationMs: number;
  output?: Record<string, unknown>;
}

interface PipelineData {
  type: "pipeline";
  strategy: string;
  steps: PipelineStep[];
  retrieval: {
    query: string;
    chunks: PipelineChunk[];
    totalChunks: number;
    latencyMs: number;
  };
  prompt: {
    systemPrompt: string;
    messages: { role: string; content: string }[];
    estimatedTokens: number;
  };
  config: {
    chunkStrategy: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    similarityThreshold: number;
    embeddingModel: string;
    retrievalMode: string;
    retrievalStrategy?: string;
    queryExpansion?: boolean;
    multiQuery?: boolean;
    reranking?: boolean;
    compression?: boolean;
  };
}

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
  pipeline?: PipelineData;
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
  kbs: { id: string; name: string; description: string | null }[];
}

export function RagChat({ kbs }: Props) {
  const [selectedKbId, setSelectedKbId] = useState(kbs[0]?.id || "");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [expandedPipeline, setExpandedPipeline] = useState<Set<string>>(new Set());
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [showPrompt, setShowPrompt] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    if (!selectedKbId) return;
    try {
      const res = await fetch(`/api/ai/conversations?kbId=${selectedKbId}`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
  }, [selectedKbId]);

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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (activeConversation) loadMessages(activeConversation);
  }, [activeConversation, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConversation = async () => {
    if (!selectedKbId) return;
    try {
      const kb = kbs.find((k) => k.id === selectedKbId);
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kbId: selectedKbId, title: `Chat about ${kb?.name || "KB"}` }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConversation(data.conversation.id);
        setMessages([]);
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    const query = input.trim();
    if (!query || !activeConversation || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: query };
    const assistantMsg: Message = { id: `assistant-${Date.now()}`, role: "assistant", content: "", pipeline: undefined };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation,
          kbId: selectedKbId,
          query,
          explainable: true,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let pipelineData: PipelineData | null = null;

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
            if (data.type === "pipeline") {
              pipelineData = data;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, pipeline: data } : m,
                ),
              );
            } else if (data.type === "chunk") {
              fullContent += data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: fullContent, pipeline: m.pipeline || pipelineData || undefined } : m,
                ),
              );
            } else if (data.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: `**Error:** ${data.content}` } : m,
                ),
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: "**Error:** Failed to get response" } : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      loadConversations();
    }
  };

  const stopGeneration = () => { abortRef.current?.abort(); setIsStreaming(false); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const togglePipeline = (id: string) => {
    setExpandedPipeline((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleChunk = (id: string) => {
    setExpandedChunks((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const chunkColors = ["bg-brand", "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500"];

  const TimelineBar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="text-text-secondary w-28 shrink-0">{label}</span>
        <div className="flex-1 h-5 rounded-md bg-bg overflow-hidden relative">
          <div className={`h-full rounded-md ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-text-primary font-mono w-16 text-right">{value.toFixed(1)}ms</span>
      </div>
    );
  };

  const ScoreBadge = ({ score }: { score: number }) => (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
      score >= 0.9 ? "bg-success/10 text-success" : score >= 0.8 ? "bg-brand/10 text-brand" : score >= 0.7 ? "bg-warning/10 text-warning" : "bg-info/10 text-info"
    }`}>
      {Math.round(score * 100)}%
    </span>
  );

  if (kbs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Bot size={48} className="text-text-tertiary mb-4" />
        <h1 className="text-xl font-semibold text-text-primary">RAG Chat</h1>
        <p className="mt-2 text-sm text-text-secondary max-w-md">
          Create a knowledge base and upload documents first to start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6 overflow-hidden">
      {showSidebar && (
        <div className="w-72 shrink-0 border-r border-border bg-surface overflow-y-auto flex flex-col">
          <div className="p-3 space-y-2 border-b border-border">
            <select
              value={selectedKbId}
              onChange={(e) => { setSelectedKbId(e.target.value); setActiveConversation(null); setMessages([]); }}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              {kbs.map((kb) => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
            <Button variant="primary" size="sm" className="w-full" onClick={createConversation}>
              <Plus size={14} />
              New conversation
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 px-2 py-2">
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
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            aria-label={showSidebar ? "Collapse sidebar" : "Expand sidebar"}
          >
            {showSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <h2 className="text-sm font-medium text-text-primary truncate">
            RAG Chat — {kbs.find((k) => k.id === selectedKbId)?.name || "Select KB"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot size={40} className="text-text-tertiary mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">RAG Chat</h3>
              <p className="text-sm text-text-secondary max-w-md">
                Ask questions about your documents. Every response shows the complete RAG pipeline — retrieval, context, prompt, and citations.
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
            <div key={msg.id} className="space-y-2">
              <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-brand text-white"
                      : "bg-surface border border-border"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <>
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content || (isStreaming ? "..." : "")}
                        </ReactMarkdown>
                      </div>
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                            Citations
                          </p>
                          <div className="space-y-1.5">
                            {msg.citations.map((c, i) => (
                              <div key={i} className="flex items-start gap-2 rounded-lg bg-bg/50 p-2 text-xs">
                                <FileText size={12} className="shrink-0 mt-0.5 text-text-tertiary" />
                                <div className="min-w-0">
                                  <p className="font-medium text-text-primary truncate">{c.documentName}</p>
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
                    </>
                  )}
                </div>
              </div>

              {msg.pipeline && msg.role === "assistant" && (
                <div className="pl-12">
                  <button
                    onClick={() => togglePipeline(msg.id)}
                    className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-primary transition-colors mb-2"
                  >
                    <GitBranch size={12} />
                    <span>RAG Pipeline</span>
                    {expandedPipeline.has(msg.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    <Badge variant="default" className="text-[10px]">
                      {msg.pipeline.retrieval.totalChunks} chunks
                    </Badge>
                    <Badge variant="default" className="text-[10px]">
                      {msg.pipeline.retrieval.latencyMs.toFixed(0)}ms
                    </Badge>
                  </button>

                  {expandedPipeline.has(msg.id) && (
                    <Card className="!p-4 space-y-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
                        Explainable RAG Pipeline
                      </div>

                      <div className="flex items-center gap-2 text-xs text-text-secondary bg-bg/50 rounded-lg p-2.5 border border-border">
                        <Search size={12} className="text-brand shrink-0" />
                        <span className="font-medium text-text-primary">User Query:</span>
                        <span className="italic truncate">&ldquo;{msg.pipeline.retrieval.query}&rdquo;</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
                          <ArrowDown size={10} />
                          <span>Strategy: <span className="font-medium text-text-primary">{msg.pipeline.strategy}</span></span>
                        </div>
                        {msg.pipeline.steps && msg.pipeline.steps.length > 0 && (
                          <div className="space-y-1">
                            {msg.pipeline.steps.map((step, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-text-secondary bg-bg/50 rounded-lg px-2.5 py-1.5 border border-border">
                                <div className="w-4 h-4 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                                  <span className="text-[8px] font-bold text-brand">{i + 1}</span>
                                </div>
                                <span className="flex-1">{step.description}</span>
                                <span className="font-mono text-text-tertiary">{step.durationMs.toFixed(1)}ms</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
                          <ArrowDown size={10} />
                          <span>Retrieval Configuration</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="default" className="text-[10px]">{msg.pipeline.config.chunkStrategy}</Badge>
                          <Badge variant="default" className="text-[10px]">size={msg.pipeline.config.chunkSize}</Badge>
                          <Badge variant="default" className="text-[10px]">overlap={msg.pipeline.config.chunkOverlap}</Badge>
                          <Badge variant="default" className="text-[10px]">topK={msg.pipeline.config.topK}</Badge>
                          <Badge variant="default" className="text-[10px]">threshold={msg.pipeline.config.similarityThreshold}</Badge>
                          <Badge variant="default" className="text-[10px]">{msg.pipeline.config.embeddingModel}</Badge>
                          {msg.pipeline.config.retrievalStrategy && <Badge variant="brand" className="text-[10px]">{msg.pipeline.config.retrievalStrategy}</Badge>}
                          {msg.pipeline.config.queryExpansion && <Badge variant="info" className="text-[10px]">Query Expansion</Badge>}
                          {msg.pipeline.config.multiQuery && <Badge variant="info" className="text-[10px]">Multi-Query</Badge>}
                          {msg.pipeline.config.reranking && <Badge variant="info" className="text-[10px]">Reranking</Badge>}
                          {msg.pipeline.config.compression && <Badge variant="info" className="text-[10px]">Compression</Badge>}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
                          <ArrowDown size={10} />
                          <span>Retrieved Documents &mdash; {msg.pipeline.retrieval.totalChunks} chunks</span>
                        </div>
                        <div className="space-y-1.5">
                          {msg.pipeline.retrieval.chunks.map((chunk, i) => (
                            <div key={chunk.id} className="rounded-lg border border-border bg-bg/30 overflow-hidden">
                              <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-bg/50 transition-colors" onClick={() => toggleChunk(chunk.id + i)}>
                                <div className={`w-1 h-6 rounded-full shrink-0 ${chunkColors[i % chunkColors.length]}`} />
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <span className="text-xs font-medium text-text-primary">#{i + 1}</span>
                                  <ScoreBadge score={chunk.similarity} />
                                  <span className="text-[11px] text-text-tertiary truncate">{chunk.documentName}</span>
                                  <span className="text-[11px] text-text-tertiary">{chunk.chunkSize} chars</span>
                                  {chunk.pageNumber && <span className="text-[11px] text-text-tertiary">p.{chunk.pageNumber}</span>}
                                </div>
                                {expandedChunks.has(chunk.id + i) ? <ChevronUp size={12} className="shrink-0 text-text-tertiary" /> : <ChevronDown size={12} className="shrink-0 text-text-tertiary" />}
                              </div>
                              {expandedChunks.has(chunk.id + i) && (
                                <div className="border-t border-border px-2.5 py-2 space-y-1.5">
                                  <p className="text-[12px] text-text-primary leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
                                  <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                                    <span>ID: {chunk.id.slice(0, 12)}...</span>
                                    <span>Index: {chunk.index}</span>
                                    <span>Tokens: {chunk.tokenCount || "?"}</span>
                                    <span>Chunk: {chunk.chunkSize} chars</span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(chunk.content)}
                                    className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary"
                                  >
                                    <Copy size={10} /> Copy
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
                          <ArrowDown size={10} />
                          <span>Prompt Construction</span>
                        </div>
                        <button
                          onClick={() => setShowPrompt(showPrompt === msg.id ? null : msg.id)}
                          className="flex items-center gap-2 text-xs text-text-secondary bg-bg/50 rounded-lg p-2.5 border border-border w-full hover:bg-bg transition-colors"
                        >
                          <Terminal size={12} />
                          <span>View complete prompt ({msg.pipeline.prompt.estimatedTokens} estimated tokens)</span>
                          <Eye size={12} className="ml-auto" />
                        </button>
                        {showPrompt === msg.id && (
                          <div className="rounded-lg border border-border bg-bg p-3 space-y-2 max-h-96 overflow-y-auto">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">System Prompt</span>
                              <button onClick={() => copyToClipboard(msg.pipeline!.prompt.systemPrompt)} className="text-text-tertiary hover:text-text-primary" aria-label="Copy system prompt"><Copy size={10} /></button>
                            </div>
                            <pre className="text-[11px] text-text-secondary whitespace-pre-wrap font-mono bg-bg/50 rounded p-2">{msg.pipeline.prompt.systemPrompt}</pre>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Full Prompt ({msg.pipeline.prompt.messages.length} messages)</span>
                              <button onClick={() => copyToClipboard(msg.pipeline!.prompt.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n"))} className="text-text-tertiary hover:text-text-primary" aria-label="Copy full prompt"><Copy size={10} /></button>
                            </div>
                            {msg.pipeline.prompt.messages.map((m, i) => (
                              <div key={i} className="text-[11px]">
                                <span className="font-semibold text-text-primary">{m.role.toUpperCase()}</span>
                                <pre className="text-text-secondary whitespace-pre-wrap font-mono mt-0.5">{m.content.slice(0, 500)}{m.content.length > 500 ? "..." : ""}</pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
                          <ArrowDown size={10} />
                          <span>LLM Generation</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary bg-bg/50 rounded-lg p-2.5 border border-border">
                          <Bot size={12} />
                          <span>Response generated with retrieved context</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <button
                          onClick={() => setShowTimeline(showTimeline === msg.id ? null : msg.id)}
                          className="flex items-center gap-2 text-xs text-text-secondary bg-bg/50 rounded-lg p-2.5 border border-border w-full hover:bg-bg transition-colors"
                        >
                          <Clock size={12} />
                          <span>Retrieval Timeline</span>
                          <span className="text-text-tertiary ml-auto">{msg.pipeline.retrieval.latencyMs.toFixed(1)}ms</span>
                        </button>
                        {showTimeline === msg.id && (
                          <div className="rounded-lg border border-border bg-bg p-3 space-y-2">
                            {msg.pipeline.steps && msg.pipeline.steps.length > 0 ? (
                              msg.pipeline.steps.map((step, i) => (
                                <TimelineBar key={i} label={step.description} value={step.durationMs} total={msg.pipeline!.retrieval.latencyMs} color={["bg-brand", "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500"][i % 5]} />
                              ))
                            ) : (
                              <>
                                <TimelineBar label="Query Embedding" value={19} total={msg.pipeline.retrieval.latencyMs} color="bg-brand" />
                                <TimelineBar label="Vector Search" value={msg.pipeline.retrieval.latencyMs * 0.6} total={msg.pipeline.retrieval.latencyMs} color="bg-blue-500" />
                                <TimelineBar label="Prompt Construction" value={msg.pipeline.retrieval.latencyMs * 0.05} total={msg.pipeline.retrieval.latencyMs} color="bg-purple-500" />
                              </>
                            )}
                            <TimelineBar label="Total Retrieval" value={msg.pipeline.retrieval.latencyMs} total={msg.pipeline.retrieval.latencyMs} color="bg-emerald-500" />
                            <div className="flex items-center gap-3 text-xs pt-2 border-t border-border">
                              <span className="text-text-tertiary">Estimated tokens: {msg.pipeline.prompt.estimatedTokens}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-4 shrink-0">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeConversation ? "Ask a question..." : "Start a conversation first..."}
              disabled={!activeConversation || isStreaming}
              rows={1}
              aria-label="RAG chat message input"
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:border-brand disabled:opacity-40"
            />
            {isStreaming ? (
              <Button variant="secondary" onClick={stopGeneration} title="Stop" aria-label="Stop generation">
                <Square size={16} />
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSubmit} disabled={!input.trim() || !activeConversation} aria-label="Send message">
                <Send size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
