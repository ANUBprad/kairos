"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  FileText,
  MessageSquare,
  BarChart3,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";

interface OnboardingStep {
  id: number;
  label: string;
  description: string;
  href: string;
  icon: typeof FolderOpen;
  completed?: boolean;
}

interface SmartEmptyStateProps {
  steps?: OnboardingStep[];
  className?: string;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 1,
    label: "Create a knowledge base",
    description: "Organize your documents in a searchable collection",
    href: "/app/knowledge-bases",
    icon: FolderOpen,
  },
  {
    id: 2,
    label: "Upload your first document",
    description: "Supports PDF, DOCX, TXT, MD, and CSV files",
    href: "/app/knowledge-bases",
    icon: FileText,
  },
  {
    id: 3,
    label: "Ask your first question",
    description: "Chat with your knowledge base using RAG",
    href: "/app/rag-chat",
    icon: MessageSquare,
  },
  {
    id: 4,
    label: "Evaluate retrieval quality",
    description: "Measure precision, recall, and MRR with benchmarks",
    href: "/app/evaluation",
    icon: BarChart3,
  },
];

function SmartEmptyState({ steps = DEFAULT_STEPS, className }: SmartEmptyStateProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-gradient-to-br from-surface via-surface to-brand/5 p-8",
      className
    )}>
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" aria-hidden="true" />

      <div className="relative text-center mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-brand/10 mx-auto mb-4">
          <Sparkles size={32} className="text-brand" />
        </div>
        <h3 className="text-xl font-bold text-text-primary">Welcome to Kairos</h3>
        <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
          Your AI Research Mission Control. Follow these steps to get started with RAG research.
        </p>
      </div>

      <div className="relative space-y-3 max-w-lg mx-auto">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.id}
              href={step.href}
              className="group flex items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface/80 p-4 transition-all hover:border-brand/30 hover:bg-brand/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-surface-hover group-hover:bg-brand/10 transition-colors shrink-0">
                {step.completed ? (
                  <Check size={18} className="text-success" />
                ) : (
                  <Icon size={18} className="text-text-tertiary group-hover:text-brand transition-colors" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand shrink-0">
                    {step.id}
                  </span>
                  <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors">
                    {step.label}
                  </p>
                </div>
                <p className="text-xs text-text-tertiary mt-0.5 ml-7">{step.description}</p>
              </div>
              <ArrowRight
                size={16}
                className="text-text-tertiary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0"
              />
            </Link>
          );
        })}
      </div>

      <div className="relative text-center mt-8">
        <Button variant="primary" size="lg" asChild>
          <Link href="/app/knowledge-bases">
            Get Started
            <ArrowRight size={16} className="ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export { SmartEmptyState };
export type { SmartEmptyStateProps, OnboardingStep };
