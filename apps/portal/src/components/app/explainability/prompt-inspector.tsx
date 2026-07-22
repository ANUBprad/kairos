"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check, FileText, MessageSquare, BookOpen } from "lucide-react";
import type { ExplainerPrompt } from "./types";

interface PromptInspectorProps {
  prompt: ExplainerPrompt;
  className?: string;
}

export function PromptInspector({ prompt, className }: PromptInspectorProps) {
  const [activeTab, setActiveTab] = useState<"system" | "messages" | "tokens">("system");
  const [copied, setCopied] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

  const handleCopy = async () => {
    const fullPrompt = prompt.messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");
    await navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const systemTokens = estimateTokens(prompt.systemPrompt);
  const historyTokens = prompt.messages
    .filter((m) => m.role !== "system")
    .reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const userTokens = prompt.messages
    .filter((m) => m.role === "user")
    .reduce((sum, m) => sum + estimateTokens(m.content), 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("system")}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              activeTab === "system" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
            )}
          >
            <FileText size={12} className="inline mr-1" />
            System
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              activeTab === "messages" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
            )}
          >
            <MessageSquare size={12} className="inline mr-1" />
            Messages ({prompt.messages.length})
          </button>
          <button
            onClick={() => setActiveTab("tokens")}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              activeTab === "tokens" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
            )}
          >
            <BookOpen size={12} className="inline mr-1" />
            Tokens
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-hover transition-colors"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {activeTab === "system" && (
        <div className="rounded-lg border border-border bg-bg p-4 max-h-[300px] overflow-y-auto">
          <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
            {prompt.systemPrompt}
          </pre>
        </div>
      )}

      {activeTab === "messages" && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {prompt.messages.map((msg, i) => {
            const isExpanded = expandedMessages.has(i);
            const tokens = estimateTokens(msg.content);
            return (
              <div key={i} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => {
                    const next = new Set(expandedMessages);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    setExpandedMessages(next);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                      msg.role === "system" ? "bg-purple-500/10 text-purple-500" :
                      msg.role === "user" ? "bg-blue-500/10 text-blue-500" :
                      "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {msg.role}
                    </span>
                    <span className="text-xs text-text-tertiary truncate max-w-[200px]">
                      {msg.content.slice(0, 80)}...
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-tertiary">{tokens} tok</span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border">
                    <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed mt-2 max-h-[200px] overflow-y-auto">
                      {msg.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "tokens" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-[11px] text-text-tertiary">System</p>
              <p className="text-lg font-bold text-text-primary font-mono">{systemTokens}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-[11px] text-text-tertiary">History</p>
              <p className="text-lg font-bold text-text-primary font-mono">{historyTokens}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-[11px] text-text-tertiary">Total</p>
              <p className="text-lg font-bold text-brand font-mono">{prompt.estimatedTokens}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-tertiary">Token Distribution</span>
            </div>
            <div className="h-3 rounded-full bg-surface-hover overflow-hidden flex">
              <div
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${prompt.estimatedTokens > 0 ? (systemTokens / prompt.estimatedTokens) * 100 : 0}%` }}
                title={`System: ${systemTokens}`}
              />
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${prompt.estimatedTokens > 0 ? (historyTokens / prompt.estimatedTokens) * 100 : 0}%` }}
                title={`History: ${historyTokens}`}
              />
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${prompt.estimatedTokens > 0 ? (userTokens / prompt.estimatedTokens) * 100 : 0}%` }}
                title={`User: ${userTokens}`}
              />
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-500" /> System
              </span>
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> History
              </span>
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> User
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
