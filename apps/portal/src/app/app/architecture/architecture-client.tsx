"use client";

import { useState } from "react";
import {
  FileText, Scissors, TableProperties, Search,
  ArrowRight, ScrollText, ListOrdered,
  Bot, BarChart3, BookOpen,
} from "lucide-react";
import { EDUCATIONAL_CONTENT } from "@/lib/evaluation/education";

interface PipelineStage {
  id: string;
  title: string;
  icon: typeof FileText;
  purpose: string;
  input: string;
  output: string;
  algorithms: string[];
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
    config: ["Storage provider", "Max file size", "Allowed file types"],
  },
  {
    id: "parser",
    title: "Parser",
    icon: ScrollText,
    purpose: "Extract raw text content from uploaded documents",
    input: "Raw document files",
    output: "Plain text with structure metadata",
    algorithms: ["PDF text extraction", "HTML parsing", "Markdown parsing"],
    config: ["Extraction mode", "Language detection"],
  },
  {
    id: "chunking",
    title: "Chunking",
    icon: Scissors,
    purpose: "Divide extracted text into smaller, retrievable pieces",
    input: "Plain text content",
    output: "Array of text chunks with indices",
    algorithms: ["Recursive splitting", "Sentence splitting", "Fixed-size", "Markdown-aware", "Semantic grouping"],
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
    algorithms: ["OpenAI text-embedding-3-small", "OpenAI text-embedding-3-large", "Gemini text-embedding-004"],
    config: ["Provider selection", "Model selection", "Batch size", "Dimensions"],
    eduContentId: "embedding",
  },
  {
    id: "vector-store",
    title: "Vector Store",
    icon: TableProperties,
    purpose: "Store embeddings in a searchable index for similarity retrieval",
    input: "Chunk embeddings + metadata",
    output: "Indexed vector database",
    algorithms: ["pgvector (PostgreSQL)", "IVFFlat index", "Cosine similarity search"],
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
    config: ["Metric selection", "Dataset specification", "Reporting format"],
    eduContentId: "recall-at-k",
  },
];

function StageDetailCard({ stage, onShowEducation }: { stage: PipelineStage; onShowEducation: (id: string) => void }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <stage.icon size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">{stage.title}</h3>
          <p className="text-xs text-muted-foreground">{stage.purpose}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
          <p className="text-sm">{stage.input}</p>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
          <p className="text-sm">{stage.output}</p>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">Algorithms</div>
        <div className="flex flex-wrap gap-1.5">
          {stage.algorithms.map((a) => (
            <span key={a} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">
              {a}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">Configuration</div>
        <div className="flex flex-wrap gap-1.5">
          {stage.config.map((c) => (
            <span key={c} className="inline-flex px-2 py-0.5 text-xs rounded-md bg-primary/5 text-primary">
              {c}
            </span>
          ))}
        </div>
      </div>

      {stage.eduContentId && (
        <button
          onClick={() => onShowEducation(stage.eduContentId!)}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <BookOpen size={12} />
          Learn more about this stage
        </button>
      )}
    </div>
  );
}

function EducationSidebar({ eduContentId, onClose }: { eduContentId: string; onClose: () => void }) {
  const content = EDUCATIONAL_CONTENT.find((e) => e.id === eduContentId);
  if (!content) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-xl border shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{content.title}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {content.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none" aria-label="Close">&times;</button>
          </div>
          <p className="text-sm text-muted-foreground">{content.summary}</p>
          <div className="text-sm leading-relaxed whitespace-pre-line">{content.body}</div>
        </div>
      </div>
    </div>
  );
}

const STAGE_COLORS = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-violet-500",
];

export function ArchitectureViewer() {
  const [selectedStage, setSelectedStage] = useState<string | null>(PIPELINE_STAGES[0]?.id ?? null);
  const [eduContentId, setEduContentId] = useState<string | null>(null);

  const selected = PIPELINE_STAGES.find((s) => s.id === selectedStage);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Architecture Viewer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore the Kairos RAG pipeline — click any stage to learn more
        </p>
      </div>

      {/* Pipeline Flow */}
      <div className="rounded-xl border bg-card p-6 mb-8 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => setSelectedStage(stage.id)}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                  selectedStage === stage.id
                    ? "bg-primary/10 ring-2 ring-primary"
                    : "hover:bg-accent"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${STAGE_COLORS[i % STAGE_COLORS.length]}`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  selectedStage === stage.id ? "text-primary" : "text-muted-foreground"
                }`}>
                  {stage.title}
                </span>
              </button>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight size={16} className="mx-2 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Stage Detail */}
      {selected && (
        <StageDetailCard
          stage={selected}
          onShowEducation={setEduContentId}
        />
      )}

      {/* All Stages Grid */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">All Pipeline Stages</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STAGES.map((stage) => (
            <StageDetailCard
              key={stage.id}
              stage={stage}
              onShowEducation={setEduContentId}
            />
          ))}
        </div>
      </div>

      {/* Education Modal */}
      {eduContentId && (
        <EducationSidebar eduContentId={eduContentId} onClose={() => setEduContentId(null)} />
      )}
    </div>
  );
}
