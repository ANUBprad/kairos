"use client";

import { useState } from "react";
import {
  FileText, Scissors, TableProperties, Search,
  ArrowRight, ScrollText, ListOrdered,
  Bot, BarChart3, BookOpen, Database,
  Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";

interface PipelineStage {
  id: string;
  title: string;
  icon: typeof FileText;
  purpose: string;
  input: string;
  output: string;
  algorithms: string[];
  libraries: string[];
  whyItMatters: string;
  example: string;
  performance: string;
  config: string[];
  eduContentId?: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "documents",
    title: "Documents",
    icon: FileText,
    purpose: "Ingest raw documents from various sources into the system",
    input: "PDF, DOCX, TXT, Markdown files",
    output: "Stored documents with metadata",
    algorithms: ["File parsing", "MIME detection", "OCR (optional)"],
    libraries: ["Cloudinary", "Next.js API Routes"],
    whyItMatters: "Every AI response starts with high-quality document ingestion. If extraction fails, downstream stages have nothing to work with.",
    example: "A 50-page PDF research paper is uploaded. The system detects it as a PDF, extracts raw text, and stores it with metadata like page count and upload timestamp.",
    performance: "< 2s for typical documents. Cloudinary handles file storage and transformation.",
    config: ["Storage provider", "Max file size", "Allowed file types"],
  },
  {
    id: "chunking",
    title: "Chunking",
    icon: Scissors,
    purpose: "Divide extracted text into smaller, retrievable pieces",
    input: "Plain text content",
    output: "Array of text chunks with indices",
    algorithms: ["Recursive splitting", "Sentence splitting", "Fixed-size", "Markdown-aware", "Semantic grouping"],
    libraries: ["LangChain text splitters", "Custom semantic chunker"],
    whyItMatters: "Chunk size determines retrieval quality. Too large = noise. Too small = lost context. The right balance is critical for accurate retrieval.",
    example: "A 10,000-word document splits into 200 chunks of ~500 tokens each. Each chunk preserves sentence boundaries and maintains context windows.",
    performance: "< 500ms for 100-page document. Recursive splitter handles most cases. Semantic chunking adds ~200ms overhead.",
    config: ["Chunk size", "Chunk overlap", "Strategy selection"],
    eduContentId: "chunking-strategies",
  },
  {
    id: "embedding",
    title: "Embedding",
    icon: TableProperties,
    purpose: "Convert text chunks into numerical vector representations",
    input: "Text chunks",
    output: "Vector embeddings (768-3072 dimensions)",
    algorithms: ["text-embedding-3-small", "text-embedding-3-large", "Gemini text-embedding-004"],
    libraries: ["OpenAI API", "Google Generative AI"],
    whyItMatters: "Embeddings capture semantic meaning. Two chunks about the same topic will have similar vectors even if they use different words.",
    example: "The chunk 'The capital of France is Paris' becomes a 1536-dimensional vector like [0.023, -0.087, 0.156, ...]. Similar chunks cluster together in vector space.",
    performance: "~50ms per batch of 100 chunks. API latency dominates. Local models reduce latency to < 10ms.",
    config: ["Provider selection", "Model selection", "Batch size", "Dimensions"],
    eduContentId: "embedding",
  },
  {
    id: "vector-store",
    title: "Vector Store",
    icon: Database,
    purpose: "Store embeddings in a searchable index for similarity retrieval",
    input: "Chunk embeddings + metadata",
    output: "Indexed vector database",
    algorithms: ["IVFFlat indexing", "Cosine similarity", "HNSW (planned)"],
    libraries: ["pgvector", "PostgreSQL 15+", "Prisma"],
    whyItMatters: "Fast similarity search is essential. pgvector provides efficient approximate nearest neighbor search directly in PostgreSQL.",
    example: "10,000 vectors are indexed. A query vector finds the 5 most similar chunks in < 50ms using IVFFlat with 100 lists.",
    performance: "< 50ms for top-10 retrieval from 100K vectors. Index build: ~2s for 10K vectors. Storage: ~6KB per 1536-dim vector.",
    config: ["Index type", "Distance metric", "Index parameters"],
  },
  {
    id: "retriever",
    title: "Retriever",
    icon: Search,
    purpose: "Find relevant chunks for a user query using similarity search",
    input: "User query (text)",
    output: "Top-K most relevant chunks",
    algorithms: ["Vector search", "BM25 keyword search", "Hybrid search (RRF)", "Multi-query expansion"],
    libraries: ["Custom BM25", "pgvector", "LangChain"],
    whyItMatters: "Retrieval quality directly determines answer quality. Hybrid search combines semantic understanding with keyword precision.",
    example: "Query 'What is the accuracy of GPT-4 on MMLU?' retrieves 10 chunks: 5 by semantic similarity, 5 by BM25 keyword match, fused via RRF.",
    performance: "Vector: < 50ms. BM25: < 30ms. Hybrid: < 100ms. Multi-query adds ~200ms for LLM expansion.",
    config: ["Top-K count", "Similarity threshold", "Retrieval strategy", "Query expansion"],
    eduContentId: "hybrid-search",
  },
  {
    id: "reranking",
    title: "Reranking",
    icon: ListOrdered,
    purpose: "Re-score retrieved chunks using deeper relevance assessment",
    input: "Top-K candidate chunks",
    output: "Re-ranked chunks by relevance score",
    algorithms: ["Cross-encoder scoring", "LLM-as-judge scoring", "Reciprocal Rank Fusion"],
    libraries: ["Cohere Rerank", "Custom cross-encoder"],
    whyItMatters: "Initial retrieval is fast but approximate. Reranking applies deeper understanding to surface the most relevant results.",
    example: "10 candidates become 5 after reranking. A chunk about 'GPT-4 benchmarks' scores 0.95 while a chunk about 'AI history' scores 0.32.",
    performance: "~100ms for 10 candidates. ~500ms for 50 candidates. Cross-encoder is O(n) in candidate count.",
    config: ["Reranker model", "Score threshold", "Max candidates"],
    eduContentId: "reranking",
  },
  {
    id: "prompt-builder",
    title: "Prompt Builder",
    icon: ScrollText,
    purpose: "Construct the LLM prompt with retrieved context and instructions",
    input: "Retrieved chunks + user query",
    output: "Structured prompt with context + instructions",
    algorithms: ["Context window management", "Token counting", "Instruction templates"],
    libraries: ["tiktoken", "Custom templates"],
    whyItMatters: "How context is presented to the LLM dramatically affects answer quality. Proper formatting reduces hallucination and improves accuracy.",
    example: "Prompt structure: System instruction + Retrieved context (3 chunks, ~1500 tokens) + User query. Total: ~2000 tokens, well within model limits.",
    performance: "< 10ms. Token counting is the bottleneck. Template rendering is negligible.",
    config: ["Template selection", "System prompt", "Max context tokens", "Compression"],
    eduContentId: "context-compression",
  },
  {
    id: "llm",
    title: "LLM",
    icon: Bot,
    purpose: "Generate natural language answer from the constructed prompt",
    input: "Prompt with context + question",
    output: "Generated answer text",
    algorithms: ["GPT-4o", "GPT-4o-mini", "Gemini 2.0 Flash", "Claude Sonnet"],
    libraries: ["OpenAI SDK", "Google Generative AI SDK"],
    whyItMatters: "The LLM synthesizes retrieved context into a coherent answer. Model choice affects speed, cost, and answer quality.",
    example: "Input: 'Based on the paper, what is the accuracy?' → Output: 'The paper reports 86.4% accuracy on the MMLU benchmark, outperforming previous state-of-the-art models by 3.2%.'",
    performance: "~1-3s for GPT-4o-mini, ~2-5s for GPT-4o. Streaming reduces perceived latency to < 500ms for first token.",
    config: ["Provider", "Model", "Temperature", "Max tokens", "Top-p"],
  },
  {
    id: "evaluation",
    title: "Evaluation",
    icon: BarChart3,
    purpose: "Measure retrieval and generation quality using standard metrics",
    input: "Retrieved chunks + generated answer + ground truth",
    output: "Quantitative metrics report",
    algorithms: ["Recall@K", "Precision@K", "MRR", "nDCG", "Hit Rate", "Faithfulness"],
    libraries: ["Custom evaluation framework", "LangChain evaluators"],
    whyItMatters: "Without evaluation, you cannot improve. Systematic metrics reveal which retrieval strategies work best for your data.",
    example: "Benchmark run: Recall@5 = 0.87, Precision@5 = 0.62, MRR = 0.78. Hybrid search outperforms pure vector by 12% on Recall@5.",
    performance: "~10s for 100-question benchmark. Evaluation is compute-bound but runs asynchronously.",
    config: ["Metric selection", "Dataset specification", "Reporting format"],
    eduContentId: "recall-at-k",
  },
];

const DATA_FLOW_STEPS = [
  { label: "PDF", desc: "Raw document file", color: "bg-blue-500" },
  { label: "Text", desc: "Extracted content", color: "bg-cyan-500" },
  { label: "Chunks", desc: "Split segments", color: "bg-teal-500" },
  { label: "Vectors", desc: "Embedding arrays", color: "bg-emerald-500" },
  { label: "Retrieved", desc: "Relevant matches", color: "bg-green-500" },
  { label: "Prompt", desc: "Structured context", color: "bg-yellow-500" },
  { label: "Answer", desc: "Generated response", color: "bg-purple-500" },
];

const TECH_STACK = {
  Frontend: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS", "Shadcn/ui"],
  AI: ["OpenAI GPT-4o", "Google Gemini", "Cohere Rerank"],
  Storage: ["Cloudinary", "Supabase", "PostgreSQL 15+"],
  "Research Core": ["pgvector", "Hybrid Retrieval", "BM25", "Reciprocal Rank Fusion"],
  Evaluation: ["Recall@K", "nDCG", "MRR", "Faithfulness Scoring"],
};

const RESEARCH_CONCEPTS = [
  {
    title: "Chunking",
    definition: "Splitting long documents into smaller segments for retrieval.",
    whyItExists: "LLMs have limited context windows. Chunks enable selective retrieval of only relevant passages.",
    howKairosUsesIt: "5 strategies: recursive, sentence, fixed-size, markdown-aware, and semantic grouping. Each optimizes for different document types.",
  },
  {
    title: "Embeddings",
    definition: "Converting text into dense numerical vectors that capture semantic meaning.",
    whyItExists: "Computers cannot compare text directly. Vectors enable mathematical similarity computation.",
    howKairosUsesIt: "Supports OpenAI text-embedding-3 (768-3072 dims) and Gemini text-embedding-004. Batch processing for efficiency.",
  },
  {
    title: "Vector Search",
    definition: "Finding chunks with similar meaning using cosine distance in embedding space.",
    whyItExists: "Keyword search misses semantic similarity. Vector search finds relevant content even with different wording.",
    howKairosUsesIt: "pgvector with IVFFlat indexing. Cosine similarity for ranking. Configurable top-K and threshold.",
  },
  {
    title: "Hybrid Retrieval",
    definition: "Combining vector similarity search with BM25 keyword search.",
    whyItExists: "Vector search excels at semantic matching. BM25 excels at exact keyword matching. Both have blind spots.",
    howKairosUsesIt: "Reciprocal Rank Fusion (RRF) merges results from both methods. Weighted scoring balances contributions.",
  },
  {
    title: "Reranking",
    definition: "Re-scoring retrieved chunks using a deeper relevance model.",
    whyItExists: "Initial retrieval is fast but approximate. Reranking applies more compute to improve precision.",
    howKairosUsesIt: "Cross-encoder scoring and LLM-as-judge evaluation. Configurable candidate pool size.",
  },
  {
    title: "Context Compression",
    definition: "Reducing retrieved context to essential information before prompting the LLM.",
    whyItExists: "Too much context confuses the LLM and increases cost. Compression focuses attention on key information.",
    howKairosUsesIt: "Token-aware truncation with smart summarization. Preserves critical details while reducing noise.",
  },
];

const PERFORMANCE_TIMINGS = [
  { stage: "Upload", time: "< 2s", width: "5%", icon: FileText },
  { stage: "Chunking", time: "< 500ms", width: "2%", icon: Scissors },
  { stage: "Embedding", time: "~50ms", width: "1%", icon: TableProperties },
  { stage: "Retrieval", time: "< 100ms", width: "3%", icon: Search },
  { stage: "Reranking", time: "~100ms", width: "3%", icon: ListOrdered },
  { stage: "Prompt Build", time: "< 10ms", width: "1%", icon: ScrollText },
  { stage: "LLM Generation", time: "~2s", width: "50%", icon: Bot },
  { stage: "Evaluation", time: "~10s", width: "35%", icon: BarChart3 },
];

function StageDetailPanel({ stage }: { stage: PipelineStage }) {
  return (
    <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <stage.icon size={24} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{stage.title}</h3>
          <p className="text-sm text-muted-foreground">{stage.purpose}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Input</div>
          <p className="text-sm">{stage.input}</p>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output</div>
          <p className="text-sm">{stage.output}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Why It Matters</div>
        <p className="text-sm text-muted-foreground leading-relaxed">{stage.whyItMatters}</p>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Example</div>
        <div className="text-sm bg-muted/50 rounded-lg p-3 font-mono text-xs leading-relaxed">{stage.example}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Algorithms</div>
          <div className="flex flex-wrap gap-1.5">
            {stage.algorithms.map((a) => (
              <span key={a} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary font-medium">
                {a}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Libraries</div>
          <div className="flex flex-wrap gap-1.5">
            {stage.libraries.map((l) => (
              <span key={l} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Performance</div>
        <p className="text-sm text-muted-foreground">{stage.performance}</p>
      </div>
    </div>
  );
}

function ResearchNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
      <BookOpen size={16} className="text-primary shrink-0 mt-0.5" />
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/30">
      <div className="text-lg font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export function ArchitectureViewer() {
  const [selectedStage, setSelectedStage] = useState<string>(PIPELINE_STAGES[0].id);
  const [expandedConcept, setExpandedConcept] = useState<number | null>(null);

  const selected = PIPELINE_STAGES.find((s) => s.id === selectedStage);

  return (
    <div className="space-y-12">
      {/* SECTION 1: Hero */}
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles size={12} />
          System Architecture
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Kairos System Architecture
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Follow the complete journey from raw documents to explainable AI responses
          through Retrieval-Augmented Generation.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <StatCard label="Chunking Strategies" value="5" />
          <StatCard label="Embedding Models" value="3+" />
          <StatCard label="Retrieval Strategies" value="8" />
          <StatCard label="Evaluation Metrics" value="12" />
        </div>
      </section>

      {/* SECTION 2: Interactive Pipeline */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Interactive Pipeline</h2>
        <p className="text-sm text-muted-foreground">Click any stage to explore its details</p>

        <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max gap-2">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.id} className="flex items-center">
                <button
                  onClick={() => setSelectedStage(stage.id)}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 min-w-[90px] ${
                    selectedStage === stage.id
                      ? "bg-primary/10 ring-2 ring-primary shadow-lg shadow-primary/10 scale-105"
                      : "hover:bg-accent/50 hover:scale-[1.02]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedStage === stage.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    <stage.icon size={18} />
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    selectedStage === stage.id ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {stage.title}
                  </span>
                  <span className="w-full h-1 rounded-full bg-muted/50">
                    <span className={`block h-full rounded-full ${selectedStage === stage.id ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  </span>
                </button>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight size={16} className="mx-1 text-muted-foreground/30 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: Detail Panel */}
      {selected && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Stage Details</h2>
          <StageDetailPanel stage={selected} />
        </section>
      )}

      {/* Research Note */}
      <ResearchNote>
        <strong>Research Note:</strong> The RAG pipeline is not just a sequence of steps — each stage introduces
        trade-offs between speed, cost, and quality. Understanding these trade-offs is key to building
        effective AI systems.
      </ResearchNote>

      {/* SECTION 4: Data Flow */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Data Flow</h2>
        <p className="text-sm text-muted-foreground">How information transforms through the pipeline</p>

        <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 overflow-x-auto">
          <div className="flex items-center gap-3 min-w-max">
            {DATA_FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-xl ${step.color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                    {step.label}
                  </div>
                  <span className="text-xs text-muted-foreground text-center max-w-[80px]">
                    {step.desc}
                  </span>
                </div>
                {i < DATA_FLOW_STEPS.length - 1 && (
                  <ArrowRight size={20} className="mx-3 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        <ResearchNote>
          <strong>Research Note:</strong> Each transformation reduces information density while increasing
          semantic precision. The goal is to compress 10,000 words into the 5 most relevant sentences
          for the LLM to synthesize.
        </ResearchNote>
      </section>

      {/* SECTION 5: Technology Stack */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Technology Stack</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(TECH_STACK).map(([category, techs]) => (
            <div key={category} className="rounded-xl border bg-card/50 backdrop-blur-sm p-5 space-y-3">
              <h3 className="font-semibold text-sm">{category}</h3>
              <div className="flex flex-wrap gap-1.5">
                {techs.map((tech) => (
                  <span key={tech} className="inline-flex px-2.5 py-1 text-xs rounded-md bg-muted/50 text-muted-foreground font-medium">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6: Research Concepts */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Research Concepts</h2>
        <p className="text-sm text-muted-foreground">Core ideas powering the Kairos pipeline</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {RESEARCH_CONCEPTS.map((concept, i) => (
            <div
              key={concept.title}
              className="rounded-xl border bg-card/50 backdrop-blur-sm p-5 space-y-3 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setExpandedConcept(expandedConcept === i ? null : i)}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{concept.title}</h3>
                {expandedConcept === i ? (
                  <ChevronUp size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{concept.definition}</p>
              {expandedConcept === i && (
                <div className="space-y-2 pt-2 border-t text-xs">
                  <div>
                    <span className="font-medium text-foreground">Why it exists: </span>
                    <span className="text-muted-foreground">{concept.whyItExists}</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">How Kairos uses it: </span>
                    <span className="text-muted-foreground">{concept.howKairosUsesIt}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 7: Performance Insights */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Performance Insights</h2>
        <p className="text-sm text-muted-foreground">Typical latency breakdown per stage</p>

        <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 space-y-3">
          {PERFORMANCE_TIMINGS.map((item) => (
            <div key={item.stage} className="flex items-center gap-4">
              <div className="w-28 text-xs text-muted-foreground text-right shrink-0">{item.stage}</div>
              <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-500"
                  style={{ width: item.width }}
                />
              </div>
              <div className="w-16 text-xs font-mono text-muted-foreground shrink-0">{item.time}</div>
            </div>
          ))}
        </div>

        <ResearchNote>
          <strong>Research Note:</strong> LLM generation dominates latency. Streaming responses provide
          the first token in ~500ms, while total generation takes 2-5 seconds. Retrieval and reranking
          together add only ~200ms overhead.
        </ResearchNote>
      </section>
    </div>
  );
}
