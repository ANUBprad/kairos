import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { ScrollReveal, StaggerContainer } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Blog",
  description: "Research notes on Retrieval-Augmented Generation, chunking strategies, embedding models, retrieval algorithms, and evaluation methodology.",
};

const articles = [
  {
    category: "Foundations",
    title: "Understanding Retrieval-Augmented Generation",
    description: "How RAG combines information retrieval with language generation to produce grounded, cited answers. The architecture, the pipeline, and why it matters.",
    readTime: "8 min",
    href: "/docs",
  },
  {
    category: "Chunking",
    title: "Chunking Strategies Explained",
    description: "Recursive, sentence, fixed-size, Markdown, and semantic chunking. How each strategy divides documents, and why the choice affects retrieval quality.",
    readTime: "6 min",
    href: "/app/chunking-studio",
  },
  {
    category: "Embeddings",
    title: "Why Embeddings Matter",
    description: "How dense vector representations capture semantic meaning. The difference between embedding models, dimensions, and why similarity is not distance.",
    readTime: "7 min",
    href: "/app/retrieval-lab",
  },
  {
    category: "Retrieval",
    title: "Hybrid Retrieval vs Vector Search",
    description: "Why combining BM25 with vector search using Reciprocal Rank Fusion consistently outperforms either strategy alone. The research evidence.",
    readTime: "9 min",
    href: "/app/retrieval-lab",
  },
  {
    category: "Retrieval",
    title: "BM25 in Modern AI Systems",
    description: "The 40-year-old algorithm that still outperforms neural search for exact keyword matching. When to use BM25, when not to, and why hybrid wins.",
    readTime: "5 min",
    href: "/app/retrieval-lab",
  },
  {
    category: "Retrieval",
    title: "How Reranking Improves Answers",
    description: "Cross-encoder reranking as a second-pass scoring mechanism. Why retrieving more chunks and reranking improves Precision@K by 10-15%.",
    readTime: "6 min",
    href: "/app/retrieval-lab",
  },
  {
    category: "Evaluation",
    title: "Evaluation Metrics Explained",
    description: "Recall@K, Precision@K, MRR, nDCG, Hit Rate, Faithfulness. What each metric measures, when to use it, and what the numbers actually mean.",
    readTime: "10 min",
    href: "/app/evaluation",
  },
  {
    category: "Explainability",
    title: "Building Explainable AI Systems",
    description: "Why black-box AI is insufficient for serious applications. How retrieval traces, similarity scores, and citation tracking create transparency.",
    readTime: "7 min",
    href: "/app/rag-chat",
  },
];

export default function BlogPage() {
  return (
    <div className="pt-28 pb-24">
      <div className="mx-auto max-w-[900px] px-6 sm:px-8">
        <ScrollReveal className="text-center mb-12">
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">
            Research Notes
          </h1>
          <p className="mt-4 text-[18px] text-text-secondary max-w-2xl mx-auto">
            Concepts, algorithms, and methodology behind Retrieval-Augmented Generation. An educational reading hub for researchers and practitioners.
          </p>
        </ScrollReveal>

        <StaggerContainer className="space-y-4" staggerDelay={0.06}>
          {articles.map((article) => (
            <Link key={article.title} href={article.href} className="block group">
              <article className="border border-border rounded-[14px] p-6 hover:border-brand/20 transition-all duration-300 bg-surface/30 hover:bg-surface/60">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-brand/10 text-brand">
                    {article.category}
                  </span>
                  <span className="text-xs text-text-tertiary">{article.readTime}</span>
                </div>
                <h2 className="text-base font-semibold text-text-primary group-hover:text-brand transition-colors mb-2">
                  {article.title}
                </h2>
                <p className="text-sm text-text-tertiary leading-relaxed mb-4">
                  {article.description}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-brand group-hover:gap-2 transition-all">
                  Explore <ArrowRight size={14} />
                </span>
              </article>
            </Link>
          ))}
        </StaggerContainer>

        <ScrollReveal className="mt-16">
          <div className="p-8 rounded-[14px] border border-border bg-surface/50 text-center">
            <BookOpen size={24} className="mx-auto mb-3 text-text-tertiary" />
            <h3 className="text-base font-semibold text-text-primary mb-2">
              Reading the source code
            </h3>
            <p className="text-sm text-text-tertiary mb-6 max-w-md mx-auto">
              The best way to understand these concepts is to experiment. Upload documents, run retrieval tests, and see the metrics change.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors"
            >
              Open Platform <ArrowRight size={14} />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
