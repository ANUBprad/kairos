import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Capabilities",
  description:
    "Explore the technical capabilities of Kairos — an open-source RAG research platform.",
};

const sections = [
  {
    title: "Supported AI Models",
    items: [
      { name: "OpenAI GPT-4o", description: "State-of-the-art language model with multimodal capabilities" },
      { name: "Google Gemini", description: "Advanced reasoning and long-context understanding" },
    ],
  },
  {
    title: "Retrieval Strategies",
    items: [
      { name: "Vector Search", description: "Dense semantic similarity via embedding space" },
      { name: "BM25", description: "Classic keyword-based lexical retrieval" },
      { name: "Hybrid", description: "Combined vector + keyword scoring" },
      { name: "Multi-hop", description: "Iterative retrieval across reasoning chains" },
      { name: "Query Expansion", description: "Rewrite and broaden queries for higher recall" },
      { name: "Reranking", description: "Cross-encoder reranking for precision" },
    ],
  },
  {
    title: "Chunking Strategies",
    items: [
      { name: "Fixed-size", description: "Split documents into uniform token windows" },
      { name: "Recursive", description: "Hierarchical splitting on structural delimiters" },
      { name: "Semantic", description: "Embedding-based boundary detection" },
    ],
  },
  {
    title: "Embeddings",
    items: [
      { name: "OpenAI Embeddings", description: "High-quality hosted embedding models" },
      { name: "Local sentence-transformers", description: "Self-hosted models with zero API dependency" },
    ],
  },
  {
    title: "Evaluation Metrics",
    items: [
      { name: "Precision", description: "Fraction of retrieved documents that are relevant" },
      { name: "Recall", description: "Fraction of relevant documents that are retrieved" },
      { name: "nDCG", description: "Normalized Discounted Cumulative Gain for ranking quality" },
      { name: "MRR", description: "Mean Reciprocal Rank across queries" },
      { name: "Faithfulness", description: "LLM-graded answer grounding in context" },
      { name: "Context Precision", description: "Relevance of retrieved context in the top-k results" },
    ],
  },
  {
    title: "Experiment Tracking",
    items: [
      { name: "Versioned Runs", description: "Full lineage of parameters, prompts, and results" },
      { name: "Benchmark Explorer", description: "Compare runs side-by-side with structured diffs" },
      { name: "Experiment Lineage", description: "Trace how experiments evolve from predecessors" },
    ],
  },
  {
    title: "Observability",
    items: [
      { name: "Prometheus", description: "Scrape-ready metrics endpoints for latency, throughput, and errors" },
      { name: "Grafana", description: "Dashboards for real-time pipeline monitoring" },
    ],
  },
  {
    title: "Architecture",
    items: [
      { name: "Next.js", description: "Frontend and API routes in TypeScript" },
      { name: "Go Gateway", description: "High-performance request routing and middleware" },
      { name: "Python Intelligence", description: "Embedding, retrieval, and evaluation services" },
      { name: "gRPC", description: "Low-latency inter-service communication" },
      { name: "PostgreSQL", description: "Durable metadata, users, and experiment storage" },
      { name: "ChromaDB", description: "Vector store for embeddings and similarity search" },
    ],
  },
];

export default function CapabilitiesPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 sm:px-8 pt-24 pb-24">
      <div className="text-center mb-16">
        <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">
          Capabilities
        </h1>
        <p className="mt-4 text-[18px] text-text-secondary max-w-xl mx-auto">
          A complete platform for building, evaluating, and comparing RAG pipelines.
        </p>
      </div>

      <div className="space-y-12">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xl font-semibold text-text-primary mb-4">{section.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <h3 className="text-sm font-semibold text-text-primary">{item.name}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
