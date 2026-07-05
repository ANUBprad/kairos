"use client";

import { FileText, Scissors, Database, FlaskConical, FileSearch, Cpu, BarChart3 } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { Pipeline } from "@/components/research/pipeline";
import { ResearchNote } from "@/components/research/research-note";

const PIPELINE_STAGES = [
  { id: "documents", label: "Documents", icon: FileText, color: "bg-blue-500" },
  { id: "chunking", label: "Chunking", icon: Scissors, color: "bg-teal-500" },
  { id: "embeddings", label: "Embeddings", icon: Database, color: "bg-emerald-500" },
  { id: "retrieval", label: "Retrieval", icon: FlaskConical, color: "bg-yellow-500" },
  { id: "prompt", label: "Prompt", icon: FileSearch, color: "bg-orange-500" },
  { id: "llm", label: "LLM", icon: Cpu, color: "bg-purple-500" },
  { id: "evaluation", label: "Evaluation", icon: BarChart3, color: "bg-violet-500" },
];

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works">
      <ScrollReveal>
        <SectionHeading>RAG Pipeline Architecture</SectionHeading>
        <SectionSubheading>
          Every stage of the retrieval-augmented generation pipeline is observable, configurable, and measurable.
        </SectionSubheading>
      </ScrollReveal>

      <div className="mt-12">
        <div className="rounded-xl border border-border bg-surface p-6">
          <Pipeline stages={PIPELINE_STAGES} size="lg" />
        </div>
      </div>

      <div className="mt-8 max-w-2xl mx-auto">
        <ResearchNote title="How RAG Works">
          Documents are parsed and split into chunks. Each chunk is converted to a vector embedding and stored in a
          vector database. When a query arrives, the system retrieves the most relevant chunks via similarity search,
          assembles them into a prompt with the original query, and sends it to an LLM for generation. Each stage
          produces measurable outputs for evaluation.
        </ResearchNote>
      </div>
    </SectionWrapper>
  );
}
