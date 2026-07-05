"use client";

import { motion } from "framer-motion";
import {
  Search,
  FileText,
  Layers,
  BarChart3,
  GitBranch,
  Shield,
  Zap,
  Globe,
} from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { StaggerContainer, staggerItem, ScrollReveal } from "@/components/shared/scroll-reveal";

const features = [
  {
    icon: Search,
    title: "Semantic Search",
    desc: "Dense vector search with pgvector and cosine similarity. Supports hybrid search combining semantic and keyword-based retrieval.",
  },
  {
    icon: FileText,
    title: "Document Intelligence",
    desc: "Upload PDF, DOCX, CSV, and Markdown files. Automatic text extraction, chunking, and metadata parsing.",
  },
  {
    icon: Layers,
    title: "Embeddings Pipeline",
    desc: "Generate embeddings via OpenAI or Gemini. Batch processing with configurable models and dimension sizes.",
  },
  {
    icon: GitBranch,
    title: "Multi-Strategy Retrieval",
    desc: "Hybrid search, MMR with cross-encoder reranking, and iterative multi-hop strategies for different query types.",
  },
  {
    icon: BarChart3,
    title: "Explainable AI",
    desc: "Every answer includes cited sources, similarity scores, and chunk-level provenance. Understand why each result was retrieved.",
  },
  {
    icon: Shield,
    title: "Evaluation Metrics",
    desc: "Measure retrieval quality with recall, precision, MRR, and NDCG. Compare strategies side by side.",
  },
  {
    icon: Zap,
    title: "Streaming Chat",
    desc: "Real-time SSE streaming with citations displayed inline. Full conversation history with token tracking.",
  },
  {
    icon: Globe,
    title: "Provider Agnostic",
    desc: "Works with OpenAI and Gemini. Bring your own LLM, embedding model, or vector store.",
  },
];

export function FeaturesGrid() {
  return (
    <SectionWrapper id="features">
      <ScrollReveal>
        <SectionHeading>Built for RAG research and experimentation</SectionHeading>
        <SectionSubheading>
          Production-grade retrieval infrastructure for AI/ML engineers.
        </SectionSubheading>
      </ScrollReveal>

      <StaggerContainer className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.06}>
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              variants={staggerItem()}
              className="group rounded-[14px] border border-border bg-surface/50 p-6 transition-all duration-300 hover:-translate-y-[2px] hover:border-brand/30 hover:bg-surface hover:shadow-lg cursor-default"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-brand/10 mb-4 group-hover:bg-brand/15 transition-colors duration-300">
                <Icon size={18} className="text-brand" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">{feature.desc}</p>
            </motion.div>
          );
        })}
      </StaggerContainer>
    </SectionWrapper>
  );
}
