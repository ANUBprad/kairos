"use client";

import { Database, Cpu, Layers, Bot, Globe, Github } from "lucide-react";
import { SectionWrapper, SectionHeading } from "./section-wrapper";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

const techStack = [
  {
    category: "Vector Database",
    items: ["PostgreSQL", "pgvector", "HNSW indexing"],
    icon: Database,
  },
  {
    category: "Embedding Models",
    items: ["OpenAI text-embedding-3", "Gemini text-embedding", "Extensible providers"],
    icon: Cpu,
  },
  {
    category: "Chunking Strategies",
    items: ["Recursive split", "Sentence split", "Fixed-size", "Markdown-aware", "Semantic grouping"],
    icon: Layers,
  },
  {
    category: "LLM Providers",
    items: ["OpenAI GPT-4o", "Gemini 2.0 Flash", "Configurable per query"],
    icon: Bot,
  },
  {
    category: "Retrieval Strategies",
    items: ["Vector search", "BM25 keyword", "Hybrid RRF", "MMR", "Query expansion", "Cross-encoder reranking"],
    icon: Globe,
  },
  {
    category: "Infrastructure",
    items: ["Next.js 15", "Prisma ORM", "Docker Compose", "MIT License"],
    icon: Github,
  },
];

export function CTASection() {
  return (
    <SectionWrapper id="tech-stack">
      <ScrollReveal>
        <SectionHeading>Technology Stack</SectionHeading>
      </ScrollReveal>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {techStack.map((tech) => {
          const Icon = tech.icon;
          return (
            <div
              key={tech.category}
              className="rounded-xl border border-border bg-surface/50 p-5 transition-all duration-200 hover:border-border-hover hover:bg-surface"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className="text-brand" />
                <h3 className="text-sm font-semibold text-text-primary">{tech.category}</h3>
              </div>
              <ul className="space-y-1">
                {tech.items.map((item) => (
                  <li key={item} className="text-xs text-text-secondary">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
