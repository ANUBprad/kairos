import type { Metadata } from "next";
import Link from "next/link";
import {
  Layers, BookOpen, Database, Scissors, FlaskConical,
  BarChart3, Eye, Trophy, ArrowRight, Search, Lightbulb,
} from "lucide-react";
import { ScrollReveal, StaggerContainer } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Learn how Retrieval-Augmented Generation works. Educational documentation on chunking, embeddings, retrieval strategies, evaluation metrics, and explainable AI.",
};

const sections = [
  {
    icon: Layers,
    title: "Architecture",
    description: "The 10-stage RAG pipeline: ingestion, chunking, embedding, retrieval, generation, evaluation.",
    href: "/app/architecture",
  },
  {
    icon: Database,
    title: "Knowledge Base",
    description: "Creating and managing knowledge bases. Document upload and processing.",
    href: "/app/knowledge-bases",
  },
  {
    icon: Scissors,
    title: "Chunking Strategies",
    description: "Five chunking strategies: recursive, sentence, fixed-size, Markdown, semantic.",
    href: "/app/chunking-studio",
  },
  {
    icon: FlaskConical,
    title: "Retrieval Strategies",
    description: "Vector search, BM25, hybrid, query expansion, multi-query, and reranking.",
    href: "/app/retrieval-lab",
  },
  {
    icon: Eye,
    title: "Explainable AI",
    description: "View which chunks were retrieved, why they matched, and how they influenced the answer.",
    href: "/app/rag-chat",
  },
  {
    icon: BarChart3,
    title: "Evaluation Metrics",
    description: "10+ IR metrics: Recall@K, Precision@K, MRR, nDCG, Hit Rate, Faithfulness.",
    href: "/app/evaluation",
  },
  {
    icon: Trophy,
    title: "Benchmark Campaigns",
    description: "Run multiple strategies against datasets. Leaderboard ranking with composite scores.",
    href: "/app/evaluation",
  },
  {
    icon: BookOpen,
    title: "Project Documentation",
    description: "Complete methodology, architecture details, results, and research questions.",
    href: "/app/project-guide",
  },
];

const pipelineSteps = [
  { number: "1", title: "Upload Documents", description: "Upload PDF, DOCX, TXT, CSV, or Markdown files. The system extracts text and detects duplicates." },
  { number: "2", title: "Chunk Generation", description: "Documents are divided into chunks using configurable strategies. Chunk size and overlap affect retrieval quality." },
  { number: "3", title: "Embedding Creation", description: "Each chunk is converted to a dense vector representation using OpenAI or Gemini embedding models." },
  { number: "4", title: "Retrieval", description: "When you ask a question, the system finds the most relevant chunks using vector search, BM25, or hybrid." },
  { number: "5", title: "Prompt Construction", description: "Retrieved chunks are assembled into a prompt with instructions for the language model." },
  { number: "6", title: "Response Generation", description: "The LLM generates an answer grounded in the retrieved documents, with citations." },
  { number: "7", title: "Evaluation", description: "Metrics measure retrieval quality, answer faithfulness, and overall system performance." },
];

const researchConcepts = [
  { title: "Chunking", description: "How document division affects what information is available for retrieval.", href: "/app/chunking-studio" },
  { title: "Embeddings", description: "Dense vector representations that capture semantic meaning.", href: "/app/retrieval-lab" },
  { title: "Hybrid Retrieval", description: "Combining vector search with BM25 using Reciprocal Rank Fusion.", href: "/app/retrieval-lab" },
  { title: "Reranking", description: "Second-pass scoring that improves Precision@K by 10-15%.", href: "/app/retrieval-lab" },
  { title: "Explainability", description: "Full visibility into which chunks were retrieved and why.", href: "/app/rag-chat" },
  { title: "Benchmarking", description: "Systematic comparison of configurations with statistical rigor.", href: "/app/evaluation" },
];

export default function DocsPage() {
  return (
    <div className="pt-28 pb-24">
      <div className="mx-auto max-w-[900px] px-6 sm:px-8">
        <ScrollReveal className="text-center mb-12">
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">
            Documentation
          </h1>
          <p className="mt-4 text-[18px] text-text-secondary max-w-2xl mx-auto">
            Learn how Retrieval-Augmented Generation works. Explore the concepts, algorithms, and methodology behind Kairos.
          </p>
        </ScrollReveal>

        {/* Search placeholder */}
        <div className="mb-12">
          <div className="relative max-w-md mx-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search documentation..."
              readOnly
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-surface/50 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
        </div>

        {/* Documentation sections */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-16" staggerDelay={0.04}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.title}
                href={section.href}
                className="group rounded-[14px] border border-border bg-surface/30 p-5 transition-all duration-300 hover:border-brand/20 hover:bg-surface/60"
              >
                <div className="flex items-start gap-3">
                  <Icon size={18} className="text-brand mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-xs text-text-tertiary leading-relaxed mt-1">
                      {section.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </StaggerContainer>

        {/* Understanding the Pipeline */}
        <section className="mb-16">
          <ScrollReveal>
            <h2 className="text-[24px] font-semibold text-text-primary mb-6">Understanding the Pipeline</h2>
            <p className="text-sm text-text-secondary mb-6">
              RAG pipelines transform raw documents into intelligent question-answering systems. Here is how data flows through Kairos:
            </p>
            <div className="space-y-3">
              {pipelineSteps.map((step) => (
                <div key={step.number} className="flex gap-4 items-start rounded-[14px] border border-border bg-surface/30 p-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand text-sm font-bold shrink-0">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
                    <p className="text-xs text-text-tertiary leading-relaxed mt-1">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </section>

        {/* Research Concepts */}
        <section className="mb-16">
          <ScrollReveal>
            <div className="flex items-center gap-2 mb-6">
              <Lightbulb size={20} className="text-brand" />
              <h2 className="text-[24px] font-semibold text-text-primary">Research Concepts</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {researchConcepts.map((concept) => (
                <Link
                  key={concept.title}
                  href={concept.href}
                  className="group rounded-[14px] border border-border bg-surface/30 p-5 transition-all duration-300 hover:border-brand/20 hover:bg-surface/60"
                >
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand transition-colors mb-1">
                    {concept.title}
                  </h3>
                  <p className="text-xs text-text-tertiary leading-relaxed">
                    {concept.description}
                  </p>
                </Link>
              ))}
            </div>
          </ScrollReveal>
        </section>

        {/* Architecture link */}
        <section className="mb-16">
          <ScrollReveal>
            <div className="rounded-[14px] border border-border bg-surface/30 p-6 text-center">
              <Layers size={24} className="mx-auto mb-3 text-brand" />
              <h3 className="text-base font-semibold text-text-primary mb-2">Architecture Overview</h3>
              <p className="text-sm text-text-tertiary mb-4 max-w-md mx-auto">
                Explore the 10-stage RAG pipeline with interactive visualization.
              </p>
              <Link
                href="/app/architecture"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:gap-2 transition-all"
              >
                View architecture <ArrowRight size={14} />
              </Link>
            </div>
          </ScrollReveal>
        </section>

        {/* Project Guide */}
        <section className="mb-16">
          <ScrollReveal>
            <div className="rounded-[14px] border border-border bg-surface/30 p-6 text-center">
              <BookOpen size={24} className="mx-auto mb-3 text-brand" />
              <h3 className="text-base font-semibold text-text-primary mb-2">Project Documentation</h3>
              <p className="text-sm text-text-tertiary mb-4 max-w-md mx-auto">
                Complete methodology, architecture details, experimental results, and research questions.
              </p>
              <Link
                href="/app/project-guide"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:gap-2 transition-all"
              >
                Open project guide <ArrowRight size={14} />
              </Link>
            </div>
          </ScrollReveal>
        </section>
      </div>
    </div>
  );
}
