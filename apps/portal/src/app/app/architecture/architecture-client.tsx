"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  FileText, Scissors, TableProperties, Search,
  ArrowRight, ScrollText, ListOrdered,
  Bot, BarChart3, BookOpen, Database,
  Sparkles, ChevronDown, ChevronUp,
  ZoomIn, ZoomOut, Maximize2, X,
  Brain, MessageSquare,
  FlaskConical, Repeat,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

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
  dependencies?: string[];
  sourceModules?: string[];
  latency?: string;
  eduContentId?: string;
}

interface ArchModule {
  id: string;
  label: string;
  shortLabel: string;
  icon: typeof FileText;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  purpose: string;
  input: string;
  output: string;
  algorithms: string[];
  latency: string;
  dependencies: string[];
  config: string[];
  sourceModules: string[];
}

const ARCH_MODULES: ArchModule[] = [
  { id: "doc-ingestion", label: "Document Ingestion", shortLabel: "Ingest", icon: FileText, x: 80, y: 200, w: 140, h: 70, color: "#3b82f6", purpose: "Ingest and parse raw documents from various sources (PDF, DOCX, TXT, MD)", input: "Raw files", output: "Parsed text + metadata", algorithms: ["MIME detection", "OCR", "Cloudinary transform"], latency: "< 2s", dependencies: [], config: ["Max file size", "Allowed types", "Storage provider"], sourceModules: ["src/lib/ingestion/*.ts", "src/api/upload/*.ts"] },
  { id: "text-chunker", label: "Text Chunker", shortLabel: "Chunker", icon: Scissors, x: 280, y: 200, w: 140, h: 70, color: "#06b6d4", purpose: "Split parsed text into retrievable segments using configurable strategies", input: "Parsed text", output: "Text chunks with indices", algorithms: ["Recursive splitting", "Semantic grouping", "Markdown-aware"], latency: "< 500ms", dependencies: ["doc-ingestion"], config: ["Chunk size", "Overlap", "Strategy"], sourceModules: ["src/lib/chunking/*.ts"] },
  { id: "embedding-svc", label: "Embedding Service", shortLabel: "Embed", icon: TableProperties, x: 480, y: 200, w: 140, h: 70, color: "#10b981", purpose: "Convert text chunks into dense vector representations", input: "Text chunks", output: "Vector embeddings (768-3072 dims)", algorithms: ["text-embedding-3-small", "text-embedding-3-large", "Gemini-embedding-004"], latency: "~50ms/batch", dependencies: ["text-chunker"], config: ["Provider", "Model", "Batch size", "Dimensions"], sourceModules: ["src/lib/embedding/*.ts"] },
  { id: "vector-store", label: "Vector Store", shortLabel: "pgvector", icon: Database, x: 680, y: 200, w: 140, h: 70, color: "#14b8a6", purpose: "Store embeddings in PostgreSQL with pgvector for similarity search", input: "Vectors + metadata", output: "Indexed vectors", algorithms: ["IVFFlat indexing", "Cosine similarity", "HNSW (planned)"], latency: "< 50ms", dependencies: ["embedding-svc"], config: ["Index type", "Distance metric", "Lists"], sourceModules: ["src/lib/vector/*.ts", "prisma/schema.prisma"] },
  { id: "query-processor", label: "Query Processor", shortLabel: "Query", icon: Brain, x: 480, y: 400, w: 140, h: 70, color: "#8b5cf6", purpose: "Parse and enrich user queries with intent detection and expansion", input: "User query", output: "Processed query + metadata", algorithms: ["Intent detection", "Query expansion", "Hybrid routing"], latency: "< 100ms", dependencies: [], config: ["Expansion strategy", "Max queries"], sourceModules: ["src/lib/query/*.ts"] },
  { id: "retriever", label: "Retriever", shortLabel: "Retrieve", icon: Search, x: 680, y: 400, w: 140, h: 70, color: "#22c55e", purpose: "Retrieve relevant chunks via vector, BM25, or hybrid search", input: "Processed query", output: "Top-K candidate chunks", algorithms: ["Vector search", "BM25", "Hybrid (RRF)", "Multi-query"], latency: "< 100ms", dependencies: ["query-processor", "vector-store"], config: ["Top-K", "Threshold", "Strategy"], sourceModules: ["src/lib/retriever/*.ts"] },
  { id: "reranker", label: "Reranker", shortLabel: "Rerank", icon: ListOrdered, x: 680, y: 520, w: 140, h: 70, color: "#f59e0b", purpose: "Re-score candidate chunks for deeper relevance assessment", input: "Top-K candidates", output: "Re-ranked chunks", algorithms: ["Cross-encoder", "LLM-as-judge", "Reciprocal Rank Fusion"], latency: "~100ms", dependencies: ["retriever"], config: ["Reranker model", "Score threshold", "Max candidates"], sourceModules: ["src/lib/reranking/*.ts"] },
  { id: "prompt-builder", label: "Prompt Builder", shortLabel: "Prompt", icon: ScrollText, x: 480, y: 640, w: 140, h: 70, color: "#ec4899", purpose: "Assemble final prompt with context window management", input: "Chunks + query", output: "Structured prompt", algorithms: ["Token counting", "Context compression", "Instruction templates"], latency: "< 10ms", dependencies: ["reranker"], config: ["Template", "Max tokens", "Compression"], sourceModules: ["src/lib/prompt/*.ts"] },
  { id: "llm-service", label: "LLM Service", shortLabel: "LLM", icon: Bot, x: 280, y: 640, w: 140, h: 70, color: "#a855f7", purpose: "Generate answers via OpenAI GPT-4o or Google Gemini", input: "Structured prompt", output: "Generated answer", algorithms: ["GPT-4o", "GPT-4o-mini", "Gemini 2.0 Flash", "Claude Sonnet"], latency: "~2s", dependencies: ["prompt-builder"], config: ["Provider", "Model", "Temperature", "Max tokens"], sourceModules: ["src/lib/llm/*.ts"] },
  { id: "eval-framework", label: "Evaluation Framework", shortLabel: "Eval", icon: BarChart3, x: 80, y: 640, w: 140, h: 70, color: "#ef4444", purpose: "Measure retrieval and generation quality with standard metrics", input: "Chunks + answer + ground truth", output: "Metrics report", algorithms: ["Recall@K", "Precision@K", "MRR", "nDCG", "Faithfulness"], latency: "~10s/benchmark", dependencies: ["retriever", "llm-service"], config: ["Metrics", "Dataset", "Reporting"], sourceModules: ["src/lib/eval/*.ts"] },
  { id: "research-intel", label: "Research Intelligence", shortLabel: "Research", icon: BookOpen, x: 80, y: 400, w: 140, h: 70, color: "#0ea5e9", purpose: "Track research trends, paper metadata, and citation graphs", input: "Papers + queries", output: "Research insights", algorithms: ["Citation graph analysis", "Trend detection", "Topic modeling"], latency: "< 500ms", dependencies: ["vector-store"], config: ["Crawl sources", "Update frequency"], sourceModules: ["src/lib/research/*.ts"] },
  { id: "copilot", label: "Copilot", shortLabel: "Copilot", icon: MessageSquare, x: 880, y: 400, w: 140, h: 70, color: "#6366f1", purpose: "Interactive AI assistant with conversational context", input: "User messages + context", output: "Conversational responses", algorithms: ["Context-aware chat", "Follow-up tracking", "Suggestion generation"], latency: "~2s", dependencies: ["llm-service", "retriever"], config: ["Context window", "Suggestion mode"], sourceModules: ["src/lib/copilot/*.ts"] },
  { id: "experiment-tracker", label: "Experiment Tracker", shortLabel: "Experiments", icon: FlaskConical, x: 280, y: 520, w: 140, h: 70, color: "#f97316", purpose: "Log and compare experiments across retrieval strategies", input: "Config + metrics", output: "Experiment logs", algorithms: ["A/B comparison", "Statistical significance", "Parameter sweep"], latency: "< 1s", dependencies: ["eval-framework"], config: ["Auto-log", "Comparison window"], sourceModules: ["src/lib/experiments/*.ts"] },
  { id: "reproducibility", label: "Reproducibility Engine", shortLabel: "Reproducibility", icon: Repeat, x: 880, y: 520, w: 140, h: 70, color: "#14b8a6", purpose: "Ensure reproducible results across runs and environments", input: "Experiment configs", output: "Reproducible pipelines", algorithms: ["Deterministic seeding", "Version pinning", "Environment snapshots"], latency: "< 1s", dependencies: ["experiment-tracker"], config: ["Snapshot frequency", "Pin versions"], sourceModules: ["src/lib/reproducibility/*.ts"] },
];

const CONNECTIONS: Array<[string, string, string]> = [
  ["doc-ingestion", "text-chunker", "Parsed text"],
  ["text-chunker", "embedding-svc", "Text chunks"],
  ["embedding-svc", "vector-store", "Vectors"],
  ["vector-store", "retriever", "Indexed vectors"],
  ["query-processor", "retriever", "Processed query"],
  ["retriever", "reranker", "Top-K candidates"],
  ["reranker", "prompt-builder", "Re-ranked chunks"],
  ["prompt-builder", "llm-service", "Structured prompt"],
  ["retriever", "eval-framework", "Retrieval results"],
  ["llm-service", "eval-framework", "Generated answer"],
  ["research-intel", "vector-store", "Research vectors"],
  ["research-intel", "copilot", "Research context"],
  ["llm-service", "copilot", "LLM responses"],
  ["eval-framework", "experiment-tracker", "Metrics data"],
  ["experiment-tracker", "reproducibility", "Experiment configs"],
];

const MODULE_DETAILS: Record<string, { purpose: string; inputs: string; outputs: string; algorithms: string[]; latency: string; dependencies: string[]; config: string[]; sourceModules: string[] }> = {
  "doc-ingestion": { purpose: "Ingest raw documents from various sources into the system", inputs: "PDF, DOCX, TXT, Markdown files", outputs: "Stored documents with metadata", algorithms: ["File parsing", "MIME detection", "OCR (optional)"], latency: "< 2s", dependencies: [], config: ["Storage provider", "Max file size", "Allowed file types"], sourceModules: ["src/lib/ingestion/*.ts"] },
  "text-chunker": { purpose: "Divide extracted text into smaller, retrievable pieces", inputs: "Plain text content", outputs: "Array of text chunks with indices", algorithms: ["Recursive splitting", "Sentence splitting", "Fixed-size", "Markdown-aware", "Semantic grouping"], latency: "< 500ms", dependencies: ["doc-ingestion"], config: ["Chunk size", "Chunk overlap", "Strategy selection"], sourceModules: ["src/lib/chunking/*.ts"] },
  "embedding-svc": { purpose: "Convert text chunks into numerical vector representations", inputs: "Text chunks", outputs: "Vector embeddings (768-3072 dimensions)", algorithms: ["text-embedding-3-small", "text-embedding-3-large", "Gemini text-embedding-004"], latency: "~50ms per batch", dependencies: ["text-chunker"], config: ["Provider selection", "Model selection", "Batch size", "Dimensions"], sourceModules: ["src/lib/embedding/*.ts"] },
  "vector-store": { purpose: "Store embeddings in a searchable index for similarity retrieval", inputs: "Chunk embeddings + metadata", outputs: "Indexed vector database", algorithms: ["IVFFlat indexing", "Cosine similarity", "HNSW (planned)"], latency: "< 50ms", dependencies: ["embedding-svc"], config: ["Index type", "Distance metric", "Index parameters"], sourceModules: ["src/lib/vector/*.ts"] },
  "query-processor": { purpose: "Parse and enrich user queries for better retrieval", inputs: "User query text", outputs: "Expanded/processed query", algorithms: ["Intent detection", "Query expansion", "Hybrid routing"], latency: "< 100ms", dependencies: [], config: ["Expansion strategy", "Max queries"], sourceModules: ["src/lib/query/*.ts"] },
  "retriever": { purpose: "Find relevant chunks for a user query using similarity search", inputs: "User query (text)", outputs: "Top-K most relevant chunks", algorithms: ["Vector search", "BM25 keyword search", "Hybrid search (RRF)", "Multi-query expansion"], latency: "< 100ms", dependencies: ["query-processor", "vector-store"], config: ["Top-K count", "Similarity threshold", "Retrieval strategy", "Query expansion"], sourceModules: ["src/lib/retriever/*.ts"] },
  "reranker": { purpose: "Re-score retrieved chunks using deeper relevance assessment", inputs: "Top-K candidate chunks", outputs: "Re-ranked chunks by relevance score", algorithms: ["Cross-encoder scoring", "LLM-as-judge scoring", "Reciprocal Rank Fusion"], latency: "~100ms", dependencies: ["retriever"], config: ["Reranker model", "Score threshold", "Max candidates"], sourceModules: ["src/lib/reranking/*.ts"] },
  "prompt-builder": { purpose: "Construct the LLM prompt with retrieved context and instructions", inputs: "Retrieved chunks + user query", outputs: "Structured prompt with context + instructions", algorithms: ["Context window management", "Token counting", "Instruction templates"], latency: "< 10ms", dependencies: ["reranker"], config: ["Template selection", "System prompt", "Max context tokens", "Compression"], sourceModules: ["src/lib/prompt/*.ts"] },
  "llm-service": { purpose: "Generate natural language answer from the constructed prompt", inputs: "Prompt with context + question", outputs: "Generated answer text", algorithms: ["GPT-4o", "GPT-4o-mini", "Gemini 2.0 Flash", "Claude Sonnet"], latency: "~2s", dependencies: ["prompt-builder"], config: ["Provider", "Model", "Temperature", "Max tokens", "Top-p"], sourceModules: ["src/lib/llm/*.ts"] },
  "eval-framework": { purpose: "Measure retrieval and generation quality using standard metrics", inputs: "Retrieved chunks + generated answer + ground truth", outputs: "Quantitative metrics report", algorithms: ["Recall@K", "Precision@K", "MRR", "nDCG", "Hit Rate", "Faithfulness"], latency: "~10s", dependencies: ["retriever", "llm-service"], config: ["Metric selection", "Dataset specification", "Reporting format"], sourceModules: ["src/lib/eval/*.ts"] },
  "research-intel": { purpose: "Track research trends, paper metadata, and citation graphs", inputs: "Papers + queries", outputs: "Research insights", algorithms: ["Citation graph analysis", "Trend detection", "Topic modeling"], latency: "< 500ms", dependencies: ["vector-store"], config: ["Crawl sources", "Update frequency"], sourceModules: ["src/lib/research/*.ts"] },
  "copilot": { purpose: "Interactive AI assistant with conversational context", inputs: "User messages + context", outputs: "Conversational responses", algorithms: ["Context-aware chat", "Follow-up tracking", "Suggestion generation"], latency: "~2s", dependencies: ["llm-service", "retriever"], config: ["Context window", "Suggestion mode"], sourceModules: ["src/lib/copilot/*.ts"] },
  "experiment-tracker": { purpose: "Log and compare experiments across retrieval strategies", inputs: "Config + metrics", outputs: "Experiment logs", algorithms: ["A/B comparison", "Statistical significance", "Parameter sweep"], latency: "< 1s", dependencies: ["eval-framework"], config: ["Auto-log", "Comparison window"], sourceModules: ["src/lib/experiments/*.ts"] },
  "reproducibility": { purpose: "Ensure reproducible results across runs and environments", inputs: "Experiment configs", outputs: "Reproducible pipelines", algorithms: ["Deterministic seeding", "Version pinning", "Environment snapshots"], latency: "< 1s", dependencies: ["experiment-tracker"], config: ["Snapshot frequency", "Pin versions"], sourceModules: ["src/lib/reproducibility/*.ts"] },
};

const PIPELINE_STAGES: PipelineStage[] = [
  { id: "documents", title: "Documents", icon: FileText, purpose: "Ingest raw documents from various sources into the system", input: "PDF, DOCX, TXT, Markdown files", output: "Stored documents with metadata", algorithms: ["File parsing", "MIME detection", "OCR (optional)"], libraries: ["Cloudinary", "Next.js API Routes"], whyItMatters: "Every AI response starts with high-quality document ingestion.", example: "A 50-page PDF is uploaded, parsed, and stored with metadata.", performance: "< 2s for typical documents.", config: ["Storage provider", "Max file size", "Allowed file types"] },
  { id: "chunking", title: "Chunking", icon: Scissors, purpose: "Divide extracted text into smaller, retrievable pieces", input: "Plain text content", output: "Array of text chunks with indices", algorithms: ["Recursive splitting", "Sentence splitting", "Fixed-size", "Markdown-aware", "Semantic grouping"], libraries: ["LangChain text splitters", "Custom semantic chunker"], whyItMatters: "Chunk size determines retrieval quality.", example: "A 10,000-word doc splits into 200 chunks of ~500 tokens each.", performance: "< 500ms for 100-page document.", config: ["Chunk size", "Chunk overlap", "Strategy selection"], eduContentId: "chunking-strategies" },
  { id: "embedding", title: "Embedding", icon: TableProperties, purpose: "Convert text chunks into numerical vector representations", input: "Text chunks", output: "Vector embeddings (768-3072 dimensions)", algorithms: ["text-embedding-3-small", "text-embedding-3-large", "Gemini text-embedding-004"], libraries: ["OpenAI API", "Google Generative AI"], whyItMatters: "Embeddings capture semantic meaning.", example: "'The capital of France is Paris' becomes a 1536-dim vector.", performance: "~50ms per batch of 100 chunks.", config: ["Provider selection", "Model selection", "Batch size", "Dimensions"], eduContentId: "embedding" },
  { id: "vector-store", title: "Vector Store", icon: Database, purpose: "Store embeddings in a searchable index for similarity retrieval", input: "Chunk embeddings + metadata", output: "Indexed vector database", algorithms: ["IVFFlat indexing", "Cosine similarity", "HNSW (planned)"], libraries: ["pgvector", "PostgreSQL 15+", "Prisma"], whyItMatters: "Fast similarity search is essential.", example: "10,000 vectors indexed. Query finds top-5 in < 50ms.", performance: "< 50ms for top-10 retrieval from 100K vectors.", config: ["Index type", "Distance metric", "Index parameters"] },
  { id: "retriever", title: "Retriever", icon: Search, purpose: "Find relevant chunks for a user query using similarity search", input: "User query (text)", output: "Top-K most relevant chunks", algorithms: ["Vector search", "BM25 keyword search", "Hybrid search (RRF)", "Multi-query expansion"], libraries: ["Custom BM25", "pgvector", "LangChain"], whyItMatters: "Retrieval quality directly determines answer quality.", example: "Query retrieves 10 chunks: 5 semantic, 5 BM25, fused via RRF.", performance: "Vector: < 50ms. BM25: < 30ms. Hybrid: < 100ms.", config: ["Top-K count", "Similarity threshold", "Retrieval strategy"], eduContentId: "hybrid-search" },
  { id: "reranking", title: "Reranking", icon: ListOrdered, purpose: "Re-score retrieved chunks using deeper relevance assessment", input: "Top-K candidate chunks", output: "Re-ranked chunks by relevance score", algorithms: ["Cross-encoder scoring", "LLM-as-judge scoring", "Reciprocal Rank Fusion"], libraries: ["Cohere Rerank", "Custom cross-encoder"], whyItMatters: "Initial retrieval is fast but approximate.", example: "10 candidates become 5 after reranking.", performance: "~100ms for 10 candidates.", config: ["Reranker model", "Score threshold", "Max candidates"], eduContentId: "reranking" },
  { id: "prompt-builder", title: "Prompt Builder", icon: ScrollText, purpose: "Construct the LLM prompt with retrieved context and instructions", input: "Retrieved chunks + user query", output: "Structured prompt with context + instructions", algorithms: ["Context window management", "Token counting", "Instruction templates"], libraries: ["tiktoken", "Custom templates"], whyItMatters: "How context is presented to the LLM dramatically affects answer quality.", example: "System instruction + 3 chunks (~1500 tokens) + user query.", performance: "< 10ms.", config: ["Template selection", "System prompt", "Max context tokens", "Compression"], eduContentId: "context-compression" },
  { id: "llm", title: "LLM", icon: Bot, purpose: "Generate natural language answer from the constructed prompt", input: "Prompt with context + question", output: "Generated answer text", algorithms: ["GPT-4o", "GPT-4o-mini", "Gemini 2.0 Flash", "Claude Sonnet"], libraries: ["OpenAI SDK", "Google Generative AI SDK"], whyItMatters: "The LLM synthesizes retrieved context into a coherent answer.", example: "Input: question → Output: answer with citations.", performance: "~1-3s for GPT-4o-mini, streaming reduces perceived latency.", config: ["Provider", "Model", "Temperature", "Max tokens", "Top-p"] },
  { id: "evaluation", title: "Evaluation", icon: BarChart3, purpose: "Measure retrieval and generation quality using standard metrics", input: "Retrieved chunks + generated answer + ground truth", output: "Quantitative metrics report", algorithms: ["Recall@K", "Precision@K", "MRR", "nDCG", "Hit Rate", "Faithfulness"], libraries: ["Custom evaluation framework", "LangChain evaluators"], whyItMatters: "Without evaluation, you cannot improve.", example: "Benchmark: Recall@5 = 0.87, MRR = 0.78.", performance: "~10s for 100-question benchmark.", config: ["Metric selection", "Dataset specification", "Reporting format"], eduContentId: "recall-at-k" },
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
  { title: "Chunking", definition: "Splitting long documents into smaller segments for retrieval.", whyItExists: "LLMs have limited context windows.", howKairosUsesIt: "5 strategies: recursive, sentence, fixed-size, markdown-aware, and semantic grouping." },
  { title: "Embeddings", definition: "Converting text into dense numerical vectors that capture semantic meaning.", whyItExists: "Computers cannot compare text directly.", howKairosUsesIt: "Supports OpenAI text-embedding-3 (768-3072 dims) and Gemini text-embedding-004." },
  { title: "Vector Search", definition: "Finding chunks with similar meaning using cosine distance in embedding space.", whyItExists: "Keyword search misses semantic similarity.", howKairosUsesIt: "pgvector with IVFFlat indexing. Cosine similarity for ranking." },
  { title: "Hybrid Retrieval", definition: "Combining vector similarity search with BM25 keyword search.", whyItExists: "Both methods have blind spots.", howKairosUsesIt: "Reciprocal Rank Fusion (RRF) merges results." },
  { title: "Reranking", definition: "Re-scoring retrieved chunks using a deeper relevance model.", whyItExists: "Initial retrieval is fast but approximate.", howKairosUsesIt: "Cross-encoder scoring and LLM-as-judge evaluation." },
  { title: "Context Compression", definition: "Reducing retrieved context to essential information before prompting the LLM.", whyItExists: "Too much context confuses the LLM.", howKairosUsesIt: "Token-aware truncation with smart summarization." },
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

const CANVAS_W = 1080;
const CANVAS_H = 760;

function getCenter(mod: ArchModule) {
  return { x: mod.x + mod.w / 2, y: mod.y + mod.h / 2 };
}

function ArchitectureDiagram({ onSelectModule, selectedId, hoveredId, onHoverModule, searchQuery }: {
  onSelectModule: (id: string) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onHoverModule: (id: string | null) => void;
  searchQuery: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.3), 3));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panStartOffset.current = { ...pan };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStartOffset.current.x + dx, y: panStartOffset.current.y + dy });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const connectedIds = useMemo(() => {
    if (!hoveredId) return new Set<string>();
    const ids = new Set<string>([hoveredId]);
    for (const [a, b] of CONNECTIONS) {
      if (a === hoveredId) ids.add(b);
      if (b === hoveredId) ids.add(a);
    }
    return ids;
  }, [hoveredId]);

  const searchLower = searchQuery.toLowerCase();
  const matchIds = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    return new Set(ARCH_MODULES.filter(m => m.label.toLowerCase().includes(searchLower)).map(m => m.id));
  }, [searchQuery]);

  return (
    <div className="relative rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden" style={{ height: 520 }}>
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
        <svg ref={svgRef} width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full h-full" style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: "center center" }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-muted-foreground/60" />
            </marker>
            <marker id="arrow-highlight" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-primary" />
            </marker>
            <style>{`
              @keyframes dashFlow { to { stroke-dashoffset: -20; } }
              .flow-line { stroke-dasharray: 8 6; animation: dashFlow 1s linear infinite; }
              .flow-line-highlight { stroke-dasharray: 10 4; animation: dashFlow 0.6s linear infinite; }
            `}</style>
          </defs>

          {CONNECTIONS.map(([fromId, toId, label], i) => {
            const from = ARCH_MODULES.find(m => m.id === fromId)!;
            const to = ARCH_MODULES.find(m => m.id === toId)!;
            const fc = getCenter(from);
            const tc = getCenter(to);
            const isHighlighted = hoveredId && (fromId === hoveredId || toId === hoveredId);
            const dimmed = hoveredId && !isHighlighted;
            const mx = (fc.x + tc.x) / 2;
            const my = (fc.y + tc.y) / 2;
            return (
              <g key={i}>
                <line x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y} className={isHighlighted ? "flow-line-highlight" : "flow-line"} stroke={isHighlighted ? "var(--primary, #6366f1)" : "var(--muted-foreground, #a1a1aa)"} strokeWidth={isHighlighted ? 2.5 : 1.5} strokeOpacity={dimmed ? 0.15 : 0.6} markerEnd={isHighlighted ? "url(#arrow-highlight)" : "url(#arrow)"} />
                <text x={mx} y={my - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={9} opacity={dimmed ? 0.15 : isHighlighted ? 0.9 : 0.5}>{label}</text>
              </g>
            );
          })}

          {ARCH_MODULES.map((mod) => {
            const isSelected = selectedId === mod.id;
            const isHovered = hoveredId === mod.id;
            const isConnected = connectedIds.has(mod.id);
            const isMatch = searchQuery && matchIds.has(mod.id);
            const dimmed = hoveredId && !isConnected && !isHovered;
            const IconComp = mod.icon;
            return (
              <g key={mod.id} onClick={(e) => { e.stopPropagation(); onSelectModule(mod.id); }} onMouseEnter={() => onHoverModule(mod.id)} onMouseLeave={() => onHoverModule(null)} className="cursor-pointer" style={{ opacity: dimmed ? 0.2 : 1, transition: "opacity 0.2s" }}>
                <rect x={mod.x} y={mod.y} width={mod.w} height={mod.h} rx={12} className={isSelected ? "fill-primary/15 stroke-primary/80" : isMatch ? "fill-yellow-500/10 stroke-yellow-500/60" : isHovered ? "fill-primary/10 stroke-primary/50" : "fill-card/80 stroke-border/50"} strokeWidth={isSelected ? 2.5 : isMatch ? 2 : 1.5} style={{ transition: "all 0.2s", filter: isSelected ? "drop-shadow(0 0 12px rgba(99,102,241,0.3))" : isHovered ? "drop-shadow(0 0 8px rgba(99,102,241,0.2))" : "none" }} />
                <foreignObject x={mod.x + 12} y={mod.y + 12} width={32} height={32}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: mod.color + "20" }}>
                    <IconComp size={16} style={{ color: mod.color }} />
                  </div>
                </foreignObject>
                <text x={mod.x + 50} y={mod.y + 32} className="fill-foreground" fontSize={12} fontWeight={600}>{mod.shortLabel}</text>
                <text x={mod.x + 12} y={mod.y + mod.h - 14} className="fill-muted-foreground" fontSize={9}>{mod.latency}</text>
                {isSelected && <rect x={mod.x} y={mod.y} width={mod.w} height={mod.h} rx={12} className="fill-transparent stroke-primary" strokeWidth={2.5} strokeDasharray="6 3" />}
                {isMatch && !isSelected && <rect x={mod.x - 2} y={mod.y - 2} width={mod.w + 4} height={mod.h + 4} rx={14} className="fill-transparent stroke-yellow-500" strokeWidth={2} strokeDasharray="4 2" />}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))} className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-accent transition-colors"><ZoomIn size={14} /></button>
        <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))} className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-accent transition-colors"><ZoomOut size={14} /></button>
        <button onClick={resetView} className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-accent transition-colors"><Maximize2 size={14} /></button>
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-3 right-3 z-10 w-40 h-28 rounded-lg bg-background/90 backdrop-blur border border-border/50 overflow-hidden">
        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full h-full">
          {CONNECTIONS.map(([fromId, toId], i) => {
            const from = ARCH_MODULES.find(m => m.id === fromId)!;
            const to = ARCH_MODULES.find(m => m.id === toId)!;
            const fc = getCenter(from);
            const tc = getCenter(to);
            return <line key={i} x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y} stroke="var(--muted-foreground, #a1a1aa)" strokeWidth={1.5} strokeOpacity={0.3} />;
          })}
          {ARCH_MODULES.map((mod) => (
            <rect key={mod.id} x={mod.x} y={mod.y} width={mod.w} height={mod.h} rx={4} fill={selectedId === mod.id ? mod.color : "var(--card, #1c1c1e)"} stroke={mod.color} strokeWidth={1} strokeOpacity={selectedId === mod.id ? 1 : 0.4} />
          ))}
        </svg>
      </div>

      {/* Module count */}
      <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md bg-background/80 backdrop-blur border border-border/50 text-[10px] text-muted-foreground">
        {ARCH_MODULES.length} modules
      </div>
    </div>
  );
}

function ModuleDetailPanel({ module, onClose }: { module: ArchModule; onClose: () => void }) {
  const detail = MODULE_DETAILS[module.id];
  const IconComp = module.icon;
  return (
    <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: module.color + "20" }}>
            <IconComp size={24} style={{ color: module.color }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{module.label}</h3>
            <p className="text-sm text-muted-foreground">{module.purpose}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors"><X size={16} /></button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inputs</div>
          <p className="text-sm">{detail?.inputs || module.input}</p>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outputs</div>
          <p className="text-sm">{detail?.outputs || module.output}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Algorithms</div>
        <div className="flex flex-wrap gap-1.5">
          {detail?.algorithms.map((a) => (
            <span key={a} className="inline-flex px-2 py-0.5 text-xs rounded-md font-medium" style={{ backgroundColor: module.color + "15", color: module.color }}>{a}</span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Latency</div>
          <p className="text-sm font-mono">{detail?.latency || module.latency}</p>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dependencies</div>
          <div className="flex flex-wrap gap-1.5">
            {detail?.dependencies?.length ? detail.dependencies.map((d) => {
              const dep = ARCH_MODULES.find(m => m.id === d);
              return <span key={d} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">{dep?.shortLabel || d}</span>;
            }) : <span className="text-xs text-muted-foreground italic">None</span>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Configuration Options</div>
        <div className="flex flex-wrap gap-1.5">
          {detail?.config.map((c) => (
            <span key={c} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">{c}</span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source Modules</div>
        <div className="flex flex-wrap gap-1.5">
          {detail?.sourceModules.map((s) => (
            <span key={s} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-muted font-mono text-muted-foreground">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
              <span key={a} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary font-medium">{a}</span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Libraries</div>
          <div className="flex flex-wrap gap-1.5">
            {stage.libraries.map((l) => (
              <span key={l} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">{l}</span>
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
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const selected = PIPELINE_STAGES.find((s) => s.id === selectedStage);
  const selectedArch = ARCH_MODULES.find((m) => m.id === selectedModule);

  return (
    <div className="space-y-12 animate-fade-in">
      <PageHeader
        title="System Architecture"
        description="Follow the complete journey from raw documents to explainable AI responses through Retrieval-Augmented Generation."
        purpose="Explore the interactive system architecture."
        relatedPages={[
          { label: "Project Guide", href: "/app/project-guide" },
          { label: "Documentation", href: "#" },
        ]}
      />

      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles size={12} />
          System Architecture
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Kairos System Architecture</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Follow the complete journey from raw documents to explainable AI responses through Retrieval-Augmented Generation.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <StatCard label="Chunking Strategies" value="5" />
          <StatCard label="Embedding Models" value="3+" />
          <StatCard label="Retrieval Strategies" value="8" />
          <StatCard label="Evaluation Metrics" value="12" />
        </div>
      </section>

      {/* SECTION: Interactive Architecture Diagram */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Architecture Explorer</h2>
            <p className="text-sm text-muted-foreground">Click modules to inspect details. Hover to highlight connections. Drag to pan, scroll to zoom.</p>
          </div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search modules..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background/50 backdrop-blur focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow" aria-label="Search architecture modules" />
          </div>
        </div>
        <ArchitectureDiagram onSelectModule={(id) => setSelectedModule(selectedModule === id ? null : id)} selectedId={selectedModule} hoveredId={hoveredModule} onHoverModule={setHoveredModule} searchQuery={searchQuery} />
      </section>

      {/* Module Detail Panel */}
      {selectedArch && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Module Details</h2>
          <ModuleDetailPanel module={selectedArch} onClose={() => setSelectedModule(null)} />
        </section>
      )}

      <ResearchNote>
        <strong>Research Note:</strong> The RAG pipeline is not just a sequence of steps — each stage introduces trade-offs between speed, cost, and quality. Understanding these trade-offs is key to building effective AI systems.
      </ResearchNote>

      {/* SECTION: Interactive Pipeline (classic view) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Pipeline Stages</h2>
        <p className="text-sm text-muted-foreground">Click any stage to explore its details</p>
        <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max gap-2">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.id} className="flex items-center">
                <button onClick={() => setSelectedStage(stage.id)} className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 min-w-[90px] ${selectedStage === stage.id ? "bg-primary/10 ring-2 ring-primary shadow-lg shadow-primary/10 scale-105" : "hover:bg-accent/50 hover:scale-[1.02]"}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${selectedStage === stage.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><stage.icon size={18} /></div>
                  <span className={`text-xs font-medium whitespace-nowrap ${selectedStage === stage.id ? "text-primary" : "text-muted-foreground"}`}>{stage.title}</span>
                  <span className="w-full h-1 rounded-full bg-muted/50"><span className={`block h-full rounded-full ${selectedStage === stage.id ? "bg-primary" : "bg-muted-foreground/30"}`} /></span>
                </button>
                {i < PIPELINE_STAGES.length - 1 && (<ArrowRight size={16} className="mx-1 text-muted-foreground/30 shrink-0" />)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {selected && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Stage Details</h2>
          <StageDetailPanel stage={selected} />
        </section>
      )}

      {/* SECTION: Data Flow */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Data Flow</h2>
        <p className="text-sm text-muted-foreground">How information transforms through the pipeline</p>
        <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 overflow-x-auto">
          <div className="flex items-center gap-3 min-w-max">
            {DATA_FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-xl ${step.color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>{step.label}</div>
                  <span className="text-xs text-muted-foreground text-center max-w-[80px]">{step.desc}</span>
                </div>
                {i < DATA_FLOW_STEPS.length - 1 && (<ArrowRight size={20} className="mx-3 text-muted-foreground/40 shrink-0" />)}
              </div>
            ))}
          </div>
        </div>
        <ResearchNote>
          <strong>Research Note:</strong> Each transformation reduces information density while increasing semantic precision. The goal is to compress 10,000 words into the 5 most relevant sentences for the LLM to synthesize.
        </ResearchNote>
      </section>

      {/* SECTION: Technology Stack */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Technology Stack</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(TECH_STACK).map(([category, techs]) => (
            <div key={category} className="rounded-xl border bg-card/50 backdrop-blur-sm p-5 space-y-3">
              <h3 className="font-semibold text-sm">{category}</h3>
              <div className="flex flex-wrap gap-1.5">
                {techs.map((tech) => (
                  <span key={tech} className="inline-flex px-2.5 py-1 text-xs rounded-md bg-muted/50 text-muted-foreground font-medium">{tech}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION: Research Concepts */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Research Concepts</h2>
        <p className="text-sm text-muted-foreground">Core ideas powering the Kairos pipeline</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {RESEARCH_CONCEPTS.map((concept, i) => (
            <div key={concept.title} className="rounded-xl border bg-card/50 backdrop-blur-sm p-5 space-y-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setExpandedConcept(expandedConcept === i ? null : i)}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{concept.title}</h3>
                {expandedConcept === i ? (<ChevronUp size={16} className="text-muted-foreground" />) : (<ChevronDown size={16} className="text-muted-foreground" />)}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{concept.definition}</p>
              {expandedConcept === i && (
                <div className="space-y-2 pt-2 border-t text-xs">
                  <div><span className="font-medium text-foreground">Why it exists: </span><span className="text-muted-foreground">{concept.whyItExists}</span></div>
                  <div><span className="font-medium text-foreground">How Kairos uses it: </span><span className="text-muted-foreground">{concept.howKairosUsesIt}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION: Performance Insights */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Performance Insights</h2>
        <p className="text-sm text-muted-foreground">Typical latency breakdown per stage</p>
        <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6 space-y-3">
          {PERFORMANCE_TIMINGS.map((item) => (
            <div key={item.stage} className="flex items-center gap-4">
              <div className="w-28 text-xs text-muted-foreground text-right shrink-0">{item.stage}</div>
              <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-500" style={{ width: item.width }} />
              </div>
              <div className="w-16 text-xs font-mono text-muted-foreground shrink-0">{item.time}</div>
            </div>
          ))}
        </div>
        <ResearchNote>
          <strong>Research Note:</strong> LLM generation dominates latency. Streaming responses provide the first token in ~500ms, while total generation takes 2-5 seconds. Retrieval and reranking together add only ~200ms overhead.
        </ResearchNote>
      </section>
    </div>
  );
}
