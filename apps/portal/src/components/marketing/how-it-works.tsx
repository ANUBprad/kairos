"use client";

import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { Pipeline } from "@/components/research/pipeline";
import { ResearchNote } from "@/components/research/research-note";

const PIPELINE_STAGES = [
  { id: "documents", label: "Documents", icon: "FileText", color: "bg-blue-500" },
  { id: "chunking", label: "Chunking", icon: "Scissors", color: "bg-teal-500" },
  { id: "embeddings", label: "Embeddings", icon: "Database", color: "bg-emerald-500" },
  { id: "retrieval", label: "Retrieval", icon: "FlaskConical", color: "bg-yellow-500" },
  { id: "prompt", label: "Prompt", icon: "FileSearch", color: "bg-orange-500" },
  { id: "llm", label: "LLM", icon: "Cpu", color: "bg-purple-500" },
  { id: "debugger", label: "Debugger", icon: "Eye", color: "bg-rose-500" },
  { id: "evaluation", label: "Evaluation", icon: "BarChart3", color: "bg-violet-500" },
];

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works">
      <ScrollReveal>
        <SectionHeading>Every Stage. Observable. Measurable.</SectionHeading>
        <SectionSubheading>
          The RAG pipeline is not a black box. Kairos instruments every stage — from ingestion to evaluation — so you can see exactly what happens to your data.
        </SectionSubheading>
      </ScrollReveal>

      <div className="mt-12">
        <div className="rounded-xl border border-border bg-surface p-6">
          <Pipeline stages={PIPELINE_STAGES} size="lg" />
        </div>
      </div>

      <div className="mt-8 max-w-2xl mx-auto">
        <ResearchNote title="Why the Debugger Matters">
          Most RAG tools show you the answer. Kairos shows you the journey: which chunks were retrieved, their similarity
          scores, how the prompt was constructed, and why specific documents were or were not included. The retrieval
          debugger makes every decision inspectable — so you can diagnose failures, validate quality, and trust the output.
        </ResearchNote>
      </div>
    </SectionWrapper>
  );
}
