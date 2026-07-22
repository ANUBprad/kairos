"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight, Copy, Check } from "lucide-react";

interface SuggestedFollowUpQuestionsProps {
  query: string;
  chunks: Array<{ content: string; documentName: string }>;
  answerText?: string;
  onSelect?: (question: string) => void;
  className?: string;
}

function generateFollowUps(
  query: string,
  chunks: Array<{ content: string; documentName: string }>,
  answerText?: string
): string[] {
  const suggestions: string[] = [];
  const queryLower = query.toLowerCase();

  // Based on chunks
  if (chunks.length > 0) {
    const docNames = [...new Set(chunks.map((c) => c.documentName))];
    if (docNames.length > 1) {
      suggestions.push(`How do ${docNames[0]} and ${docNames[1]} compare on this topic?`);
    }
    suggestions.push(`What are the limitations mentioned in ${docNames[0] || "the documents"}?`);
  }

  // Based on query patterns
  if (queryLower.includes("what")) {
    suggestions.push(`Why is this the case?`);
    suggestions.push(`Can you provide specific examples?`);
  } else if (queryLower.includes("how")) {
    suggestions.push(`What are the prerequisites?`);
    suggestions.push(`What are common pitfalls?`);
  } else if (queryLower.includes("why")) {
    suggestions.push(`What evidence supports this?`);
    suggestions.push(`Are there alternative explanations?`);
  } else {
    suggestions.push(`What are the key takeaways?`);
    suggestions.push(`How does this compare to related topics?`);
  }

  // Based on answer
  if (answerText && answerText.length > 100) {
    suggestions.push(`Can you summarize this in 2-3 bullet points?`);
  }

  return suggestions.slice(0, 4);
}

export function SuggestedFollowUpQuestions({
  query,
  chunks,
  answerText,
  onSelect,
  className,
}: SuggestedFollowUpQuestionsProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const suggestions = generateFollowUps(query, chunks, answerText);

  const handleCopy = async (question: string, idx: number) => {
    await navigator.clipboard.writeText(question);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Sparkles size={12} className="text-brand" />
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
          Suggested Follow-ups
        </span>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((question, i) => (
          <div
            key={i}
            className="group flex items-center gap-2 rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-brand/30 hover:bg-brand/5"
          >
            <button
              onClick={() => onSelect?.(question)}
              className="flex-1 text-left text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {question}
            </button>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleCopy(question, i)}
                className="rounded p-1 text-text-tertiary hover:bg-surface-hover transition-colors"
              >
                {copiedIdx === i ? <Check size={10} className="text-success" /> : <Copy size={10} />}
              </button>
              <button
                onClick={() => onSelect?.(question)}
                className="rounded p-1 text-brand hover:bg-brand/10 transition-colors"
              >
                <ArrowRight size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
