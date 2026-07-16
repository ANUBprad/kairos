import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText, Scissors, Database, FlaskConical, Eye, BarChart3,
  Beaker, Trophy, FileBarChart, ArrowRight,
} from "lucide-react";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Features",
  description: "Research modules for studying chunking strategies, embedding models, retrieval algorithms, evaluation metrics, and explainable AI in RAG systems.",
};

const modules = [
  {
    icon: FileText,
    title: "Document Intelligence",
    what: "Upload PDF, DOCX, TXT, CSV, and Markdown files with automatic text extraction, SHA-256 deduplication, and processing status tracking.",
    why: "Garbage in, garbage out. Document quality determines retrieval quality. Proper ingestion is the foundation of any RAG system.",
    learn: "How document preprocessing affects downstream retrieval. Why deduplication matters. How file type impacts extraction quality.",
    href: "/app/knowledge-bases",
  },
  {
    icon: Scissors,
    title: "Chunking Strategies",
    what: "Five chunking strategies: recursive (general-purpose), sentence (factual QA), fixed-size (predictable), Markdown (structured docs), and semantic (narrative). Configurable chunk size and overlap.",
    why: "Chunk size and strategy directly determine what information is available for retrieval. Too small loses context. Too large introduces noise.",
    learn: "The precision-recall tradeoff in chunking. Why 500-1000 tokens is the sweet spot. How overlap prevents information loss at boundaries.",
    href: "/app/chunking-studio",
  },
  {
    icon: Database,
    title: "Embedding Pipeline",
    what: "Multi-provider embeddings (OpenAI, Gemini) stored in pgvector. Model selection, dimension configuration, and batch processing.",
    why: "Embeddings are the bridge between text and search. The choice of embedding model determines what 'similarity' means for your system.",
    learn: "How embedding models differ. Why dimensions matter. The relationship between embedding quality and retrieval accuracy.",
    href: "/app/retrieval-lab",
  },
  {
    icon: FlaskConical,
    title: "Retrieval Science",
    what: "Interactive retrieval testing with real-time parameter adjustment. Compare vector search, BM25, hybrid (RRF), query expansion, multi-query, and reranking strategies.",
    why: "No single strategy works best for all queries. The research shows hybrid approaches consistently outperform individual strategies.",
    learn: "When to use each strategy. How Reciprocal Rank Fusion combines results. Why query expansion improves recall by 5-10%.",
    href: "/app/retrieval-lab",
  },
  {
    icon: Eye,
    title: "Explainable AI",
    what: "View which chunks were retrieved, why they matched (similarity scores), and how they influenced the generated answer. Full prompt visibility with citations.",
    why: "A RAG system that cannot explain its answers is a black box. Explainability is required for debugging, validation, and trust.",
    learn: "How to identify retrieval failures. Why some chunks are retrieved but not used. How prompt construction affects answer quality.",
    href: "/app/rag-chat",
  },
  {
    icon: BarChart3,
    title: "Evaluation Framework",
    what: "10+ Information Retrieval metrics: Recall@K, Precision@K, MRR, nDCG, Hit Rate, Faithfulness, Context Precision, Context Recall. Statistical analysis with confidence intervals.",
    why: "Single metrics are misleading. Statistical rigor requires confidence intervals, distribution analysis, and proper comparison methodology.",
    learn: "What each metric actually measures. Why Recall@K matters more than accuracy for retrieval. How to interpret nDCG scores.",
    href: "/app/evaluation",
  },
  {
    icon: Beaker,
    title: "Experiment Tracking",
    what: "Record every experiment configuration, capture retrieval traces, and compare results across runs. Automatic metric calculation and aggregation.",
    why: "Reproducibility requires capturing every variable. Without experiment tracking, results cannot be validated or compared.",
    learn: "How to design controlled experiments. Why configuration snapshots matter. The importance of latency tracking alongside quality metrics.",
    href: "/app/experiment-builder",
  },
  {
    icon: Trophy,
    title: "Benchmark Campaigns",
    what: "Run multiple strategies, embedding models, and chunk configurations against labeled datasets. Leaderboard ranking with composite scores.",
    why: "Individual experiments show what works for one configuration. Campaigns show what works best across the configuration space.",
    learn: "How to design benchmark datasets. Why multi-configuration comparison is necessary. How composite scores weight different metrics.",
    href: "/app/evaluation",
  },
  {
    icon: FileBarChart,
    title: "Academic Report Generation",
    what: "Export comprehensive evaluation reports in Markdown and JSON. Title page, executive summary, configuration matrix, metric tables, statistical analysis, and recommendations.",
    why: "Research requires documentation. Reports enable sharing findings, peer review, and building on previous work.",
    learn: "How to structure a research report. What belongs in an executive summary. How to present statistical results clearly.",
    href: "/app/evaluation",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <div className="pt-28 pb-8 text-center px-6 sm:px-8">
        <ScrollReveal>
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">
            Research Modules
          </h1>
          <p className="mt-4 text-[18px] text-text-secondary max-w-2xl mx-auto">
            Nine modules covering the complete RAG research pipeline — from document ingestion to academic reporting.
          </p>
        </ScrollReveal>
      </div>

      <SectionWrapper>
        <div className="max-w-4xl mx-auto space-y-8">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <ScrollReveal key={mod.title} delay={i * 0.04}>
                <div className="rounded-[14px] border border-border bg-surface/50 p-6 sm:p-8 transition-all duration-300 hover:border-brand/20 hover:bg-surface hover:shadow-lg group">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 mt-1">
                      <Icon size={20} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-text-primary mb-3">{mod.title}</h2>
                      <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <div>
                          <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">What it is</span>
                          <p className="mt-1 text-text-secondary leading-relaxed">{mod.what}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Why it matters</span>
                          <p className="mt-1 text-text-secondary leading-relaxed">{mod.why}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">What you learn</span>
                          <p className="mt-1 text-text-secondary leading-relaxed">{mod.learn}</p>
                        </div>
                      </div>
                      <Link
                        href={mod.href}
                        className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-brand group-hover:gap-2 transition-all"
                      >
                        Try it <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </SectionWrapper>

      <div className="text-center py-20 px-6 sm:px-8">
        <ScrollReveal>
          <h2 className="text-[24px] font-semibold text-text-primary mb-4">Start experimenting</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">Upload documents, run retrieval tests, and generate evaluation reports.</p>
          <Button variant="primary" size="lg" asChild>
            <Link href="/app">Launch Workspace <ArrowRight size={16} /></Link>
          </Button>
        </ScrollReveal>
      </div>
    </>
  );
}
