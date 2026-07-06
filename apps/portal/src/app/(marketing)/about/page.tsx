import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, FlaskConical, BarChart3 } from "lucide-react";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal, StaggerContainer } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "About",
  description: "Why Kairos exists, the problems RAG solves, and why systematic evaluation of retrieval strategies matters for AI research.",
};

const researchGoals = [
  {
    icon: FlaskConical,
    title: "Empirical Comparison",
    description: "Enable side-by-side evaluation of chunking strategies, embedding models, and retrieval algorithms under controlled conditions.",
  },
  {
    icon: BarChart3,
    title: "Statistical Rigor",
    description: "Provide metrics with confidence intervals, descriptive statistics, and distribution analysis — not just single numbers.",
  },
  {
    icon: BookOpen,
    title: "Reproducibility",
    description: "Every experiment configuration is captured, every result is exportable, and every claim is backed by data.",
  },
];

const timeline = [
  { year: "2024", event: "Problem identification: lack of reproducible RAG evaluation tools" },
  { year: "2025", event: "Core pipeline implementation: ingestion, chunking, embedding, retrieval" },
  { year: "2025", event: "Evaluation framework: 10+ IR metrics with statistical analysis" },
  { year: "2026", event: "Advanced retrieval: hybrid, query expansion, reranking, multi-query" },
  { year: "2026", event: "Benchmark campaigns and leaderboard system" },
  { year: "2026", event: "Open-source release" },
];

export default function AboutPage() {
  return (
    <>
      <div className="pt-28 pb-8 text-center px-6 sm:px-8">
        <ScrollReveal>
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">
            Why Kairos Exists
          </h1>
          <p className="mt-4 text-[18px] text-text-secondary max-w-2xl mx-auto">
            A research platform for understanding what actually works in Retrieval-Augmented Generation.
          </p>
        </ScrollReveal>
      </div>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-5">The Problem</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Large Language Models are powerful, but they have fundamental limitations. They hallucinate. They have stale knowledge. They cannot cite their sources. Retrieval-Augmented Generation addresses these problems by retrieving relevant documents and providing them as context during generation.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            But building an effective RAG system requires navigating a complex configuration space. How should documents be chunked? Which embedding model works best for your domain? Should you use vector search, keyword search, or hybrid? How many chunks should you retrieve? Should they be reranked?
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Without systematic evaluation, practitioners rely on intuition. Kairos exists to replace intuition with evidence.
          </p>
        </ScrollReveal>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-5">Why Traditional Search Fails</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Traditional keyword search (BM25, TF-IDF) matches exact terms. It works well when you know the right words to search for. But it fails when:
          </p>
          <ul className="text-[15px] text-text-secondary leading-relaxed space-y-2 mb-4">
            <li className="flex gap-2">
              <span className="text-brand mt-1">—</span>
              <span>The query uses different vocabulary than the document (&quot;car&quot; vs &quot;automobile&quot;)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand mt-1">—</span>
              <span>The question requires understanding semantic meaning, not just matching words</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand mt-1">—</span>
              <span>The answer requires synthesizing information from multiple documents</span>
            </li>
          </ul>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Vector search addresses these issues by representing documents as dense embeddings in a high-dimensional space. Semantic similarity replaces lexical matching. But vector search has its own limitations — it can miss exact keyword matches, and it struggles with precise factual retrieval.
          </p>
        </ScrollReveal>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-5">Why Retrieval-Augmented Generation</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            RAG combines the best of both worlds. It retrieves relevant documents using whatever strategy works best — vector search, keyword search, or hybrid — and provides them as context to a language model. The model generates answers grounded in actual documents, with citations.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            But RAG introduces new questions: How does retrieval quality affect generation quality? What metrics actually measure whether a RAG system is working? How do you compare different configurations statistically?
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Kairos provides the tools to answer these questions empirically. Run controlled experiments. Measure what matters. Make data-driven decisions.
          </p>
        </ScrollReveal>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-5">Why Compare Retrieval Strategies</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            No single retrieval strategy works best for all queries. Simple factual questions (&quot;What is the refund policy?&quot;) benefit from fast keyword lookup. Complex analytical questions (&quot;Compare Q1 and Q3 revenue and explain the variance&quot;) require multi-hop reasoning across documents.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            The research shows that hybrid approaches — combining vector search with BM25 using Reciprocal Rank Fusion — consistently outperform either strategy alone. Query expansion improves recall by 5-10%. Reranking improves precision by 10-15%. But these improvements depend on the domain, the query distribution, and the chunking strategy.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Systematic comparison is the only way to know what works for your specific use case.
          </p>
        </ScrollReveal>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-5">Why Explainability Matters</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            A RAG system that cannot explain its answers is a black box. Users need to know which documents were retrieved, why they matched, and how they influenced the generated answer. Without this transparency, there is no way to debug retrieval failures, validate answer quality, or build trust.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Kairos provides full visibility into every stage of the pipeline: which chunks were retrieved, their similarity scores, the prompt constructed for the LLM, and the final answer with citations. This is not a nice-to-have — it is a requirement for any serious AI system.
          </p>
        </ScrollReveal>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-5">Why Students Should Care</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            RAG is one of the most important applications of AI today. It is used in search engines, customer support systems, legal research, medical question answering, and countless other domains. Understanding how to build, evaluate, and optimize RAG systems is a valuable skill.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Kairos provides a hands-on way to learn these concepts. Upload your own documents. Experiment with different configurations. Run benchmarks. Generate reports. The platform teaches by doing.
          </p>
        </ScrollReveal>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="text-center">
          <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary">Research Goals</h2>
          <p className="mt-3 text-[16px] text-text-secondary max-w-2xl mx-auto">
            What Kairos is designed to investigate.
          </p>
        </ScrollReveal>
        <StaggerContainer className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.08}>
          {researchGoals.map((goal) => {
            const Icon = goal.icon;
            return (
              <Card key={goal.title} className="border-border/60">
                <Icon size={18} className="text-brand mb-3" />
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">{goal.title}</h3>
                <p className="text-xs text-text-tertiary leading-relaxed">{goal.description}</p>
              </Card>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      <SectionWrapper>
        <ScrollReveal className="max-w-3xl mx-auto">
          <h2 className="text-[24px] font-semibold text-text-primary mb-8">Project Timeline</h2>
          <div className="space-y-4">
            {timeline.map((item) => (
              <div key={item.event} className="flex gap-4 items-start">
                <span className="text-sm font-mono text-brand shrink-0 mt-0.5">{item.year}</span>
                <p className="text-[15px] text-text-secondary">{item.event}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </SectionWrapper>

      <div className="text-center py-20 px-6 sm:px-8">
        <ScrollReveal>
          <h2 className="text-[28px] font-semibold text-text-primary mb-4">
            See what the research looks like
          </h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            Explore the architecture, try the retrieval lab, or read about the evaluation metrics.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/app">
                Open Platform <ArrowRight size={16} />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/features">
                Explore Features
              </Link>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
