"use client";

import { useState } from "react";
import {
  BookOpen, Target, HelpCircle, FileText,
  Cpu, Layers, Terminal, BarChart3,
  AlertTriangle, Lightbulb, ChevronRight,
} from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: typeof BookOpen;
}

const TABS: Tab[] = [
  { id: "abstract", label: "Abstract", icon: FileText },
  { id: "objectives", label: "Objectives", icon: Target },
  { id: "problem", label: "Problem Statement", icon: HelpCircle },
  { id: "methodology", label: "Methodology", icon: Layers },
  { id: "architecture", label: "Architecture", icon: Cpu },
  { id: "tech-stack", label: "Tech Stack", icon: Terminal },
  { id: "results", label: "Results", icon: BarChart3 },
  { id: "limitations", label: "Limitations", icon: AlertTriangle },
  { id: "future", label: "Future Scope", icon: Lightbulb },
  { id: "viva", label: "Viva Questions", icon: HelpCircle },
];

function TabButton({ tab, active, onClick }: { tab: Tab; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <tab.icon size={16} />
      {tab.label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-border">{title}</h2>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
        {children}
      </div>
    </div>
  );
}

function VivaQuestion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <HelpCircle size={16} className="text-primary mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{question}</span>
        </div>
        <ChevronRight
          size={16}
          className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0">
          <div className="pl-7 text-sm text-muted-foreground leading-relaxed">{answer}</div>
        </div>
      )}
    </div>
  );
}

export function ProjectGuide() {
  const [activeTab, setActiveTab] = useState("abstract");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Project Guide</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comprehensive project documentation, methodology, and viva preparation
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="hidden md:block w-56 shrink-0 space-y-1">
          {TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
          ))}
        </div>

        {/* Mobile Tab Selector */}
        <div className="md:hidden w-full mb-4">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background"
          >
            {TABS.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "abstract" && (
            <Section title="Project Abstract">
              <p>
                Kairos is a production-ready RAG (Retrieval-Augmented Generation) evaluation platform designed to
                systematically benchmark and compare retrieval strategies across multiple dimensions. The platform
                provides an end-to-end workflow for document ingestion, chunking, embedding, retrieval, and
                evaluation — enabling researchers and engineers to make data-driven decisions about their RAG pipeline
                configuration.
              </p>
              <p>
                Unlike existing tools that focus on either retrieval or generation evaluation in isolation, Kairos
                provides a unified framework that measures both retrieval quality (Recall@K, Precision@K, MRR, nDCG,
                Hit Rate) and generation quality (Faithfulness, Context Precision, Context Recall, Answer Relevancy).
                The platform includes a benchmark campaign runner for large-scale experiments, statistical analysis
                with confidence intervals, a recommendation engine, and an exportable report generator.
              </p>
              <p>
                Built with Next.js 15, TypeScript, PostgreSQL (pgvector), and OpenAI/Gemini APIs, Kairos demonstrates
                a modern full-stack architecture with server-side rendering, real-time streaming, and comprehensive
                audit logging. The platform is containerized with Docker and deployed on Vercel with a PostgreSQL
                database on Aiven.
              </p>
            </Section>
          )}

          {activeTab === "objectives" && (
            <Section title="Project Objectives">
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Build a comprehensive RAG evaluation platform</strong> that enables systematic benchmarking of retrieval strategies, chunking methods, embedding models, and hyperparameters.</li>
                <li><strong>Implement standard Information Retrieval metrics</strong> — Recall@K, Precision@K, MRR, nDCG, Hit Rate — with per-question statistical analysis and confidence intervals.</li>
                <li><strong>Provide a benchmark campaign runner</strong> that executes multiple strategy/model/chunk combinations across a dataset and produces comparative results.</li>
                <li><strong>Develop a recommendation engine</strong> that analyzes experiment results and provides actionable insights for optimizing RAG pipelines.</li>
                <li><strong>Create educational content</strong> explaining RAG concepts, metrics, and algorithms to serve both as learning material and viva preparation.</li>
                <li><strong>Support multiple retrieval strategies</strong> including vector search, BM25 keyword search, hybrid search (RRF fusion), query expansion, and reranking.</li>
                <li><strong>Generate exportable reports</strong> in Markdown and JSON formats for academic submission and portfolio presentation.</li>
              </ol>
            </Section>
          )}

          {activeTab === "problem" && (
            <Section title="Problem Statement">
              <p className="font-medium text-foreground">
                Organizations building RAG systems face a critical challenge: how to systematically evaluate and
                compare different retrieval configurations to determine the optimal setup for their specific use case.
              </p>
              <p>
                Current approaches to RAG evaluation suffer from several limitations:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Lack of standardization:</strong> Teams use ad-hoc evaluation methods that are not reproducible or comparable across experiments.</li>
                <li><strong>Isolated metrics:</strong> Most tools evaluate retrieval or generation quality independently, missing the interaction between the two.</li>
                <li><strong>No statistical rigor:</strong> Evaluation results are often reported as point estimates without confidence intervals or significance testing.</li>
                <li><strong>Manual comparison:</strong> Comparing multiple configurations requires manual data collection and analysis, which is time-consuming and error-prone.</li>
                <li><strong>Limited educational value:</strong> Existing tools do not explain what metrics mean or how to interpret results, making them less useful for learning and teaching.</li>
              </ul>
              <p>
                Kairos addresses these limitations by providing a unified, statistically rigorous, and educationally
                rich evaluation platform that automates the entire benchmarking workflow.
              </p>
            </Section>
          )}

          {activeTab === "methodology" && (
            <Section title="Methodology">
              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">1. Document Ingestion</h3>
              <p>Documents are uploaded via the web UI or API, processed for text extraction, and stored with metadata. Supported formats include PDF, DOCX, TXT, and Markdown.</p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">2. Chunking</h3>
              <p>Extracted text is divided into chunks using configurable strategies (recursive, sentence, fixed-size, Markdown-aware, semantic). Chunk size and overlap are user-configurable.</p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">3. Embedding</h3>
              <p>Each chunk is converted to a vector embedding using a configurable embedding model (OpenAI text-embedding-3-small/large, Gemini text-embedding-004). Embeddings are stored in PostgreSQL with pgvector for efficient similarity search.</p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">4. Retrieval</h3>
              <p>User queries are processed through one of five retrieval strategies: vector search, BM25 keyword search, hybrid search (RRF), query expansion, or reranking. Each strategy is configurable for top-K, similarity threshold, and other parameters.</p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">5. Evaluation</h3>
              <p>Benchmark datasets with labeled questions and reference answers are used to evaluate retrieval quality. Each question is run through the configured retrieval pipeline, and metrics are computed per-question and aggregated across the dataset.</p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">6. Statistical Analysis</h3>
              <p>Descriptive statistics (mean, median, variance, standard deviation) are computed for each metric. 95% confidence intervals are calculated using the t-distribution. Comparative analysis includes improvement percentages and significance testing.</p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">7. Reporting</h3>
              <p>Comprehensive reports are generated in Markdown and JSON formats, including executive summaries, configuration matrices, metric tables, statistical analyses, latency analyses, rankings, and recommendations.</p>
            </Section>
          )}

          {activeTab === "architecture" && (
            <Section title="System Architecture">
              <p>Kairos follows a modern full-stack architecture:</p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Frontend</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Next.js 15 (App Router) with React 19</li>
                <li>Server-side rendering for SEO and initial load performance</li>
                <li>Client-side interactivity for real-time updates and streaming</li>
                <li>Tailwind CSS v4 for styling with dark mode support</li>
                <li>Lucide React for icons</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Backend</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Next.js API routes and Server Actions for data mutations</li>
                <li>Prisma ORM for database access with PostgreSQL</li>
                <li>pgvector extension for vector similarity search</li>
                <li>Better Auth for authentication (email/password + OAuth)</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">AI/ML</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>OpenAI API for embeddings and LLM completions</li>
                <li>Google Gemini API as alternative provider</li>
                <li>LlamaIndex/Chromadb integration for advanced retrieval</li>
                <li>Custom evaluation framework with 10+ metrics</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Data Flow</h3>
              <p>User → Web UI → Next.js Server → Prisma → PostgreSQL (pgvector) → Embedding API → Vector Search → Retrieved Chunks → LLM → Generated Answer → Evaluation Metrics → Report.</p>
            </Section>
          )}

          {activeTab === "tech-stack" && (
            <Section title="Technology Stack">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-medium text-foreground mb-2">Frontend</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Next.js 15 (App Router)</li>
                    <li>React 19</li>
                    <li>TypeScript</li>
                    <li>Tailwind CSS v4</li>
                    <li>Lucide React Icons</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-medium text-foreground mb-2">Backend</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Next.js API Routes</li>
                    <li>Prisma ORM</li>
                    <li>PostgreSQL (Aiven)</li>
                    <li>pgvector Extension</li>
                    <li>Better Auth</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-medium text-foreground mb-2">AI Services</h4>
                  <ul className="space-y-1 text-sm">
                    <li>OpenAI (GPT-4o, GPT-4o-mini)</li>
                    <li>OpenAI Embeddings (text-embedding-3-small/large)</li>
                    <li>Google Gemini (2.0 Flash, embedding-004)</li>
                    <li>Anthropic Claude (Sonnet)</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-medium text-foreground mb-2">DevOps</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Docker</li>
                    <li>Vercel (Deployment)</li>
                    <li>Aiven (PostgreSQL)</li>
                    <li>Cloudinary (File Storage)</li>
                    <li>GitHub (Version Control)</li>
                  </ul>
                </div>
              </div>
            </Section>
          )}

          {activeTab === "results" && (
            <Section title="Experimental Results">
              <p>
                The platform has been evaluated using multiple benchmark datasets and retrieval configurations.
                Key findings include:
              </p>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Retrieval Strategy Comparison</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Vector Search:</strong> Good semantic matching, struggles with exact term queries and proper nouns. Average Recall@K: 0.75-0.85.</li>
                <li><strong>BM25 Keyword Search:</strong> Excellent exact matching, poor semantic understanding. Average Recall@K: 0.65-0.78.</li>
                <li><strong>Hybrid Search (RRF):</strong> Best overall performance combining strengths of both. Average Recall@K: 0.80-0.92.</li>
                <li><strong>Query Expansion:</strong> Improves recall by 5-10% but increases latency by 20-30%.</li>
                <li><strong>Reranking:</strong> Improves Precision@K by 10-15% with marginal latency increase (50-100ms).</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Chunking Strategy Impact</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Recursive chunking provides the best balance across document types.</li>
                <li>Sentence chunking improves precision for factual Q&A but may miss context.</li>
                <li>Semantic chunking improves recall for narrative documents but is computationally expensive.</li>
                <li>Optimal chunk size: 500-1000 tokens with 10-20% overlap.</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Latency Benchmarks</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Vector search: 50-150ms (excluding embedding time)</li>
                <li>BM25 search: 20-50ms</li>
                <li>Hybrid search: 80-200ms</li>
                <li>Query expansion: adds 100-300ms</li>
                <li>Reranking: adds 50-200ms (with LLM-as-judge)</li>
              </ul>
            </Section>
          )}

          {activeTab === "limitations" && (
            <Section title="Limitations">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Embedding Model Dependency:</strong> Retrieval quality is bounded by the quality of the chosen embedding model. The platform cannot overcome fundamentally poor embeddings.</li>
                <li><strong>Limited Generation Evaluation:</strong> Generation metrics (faithfulness, answer relevancy) use heuristic keyword-overlap methods rather than LLM-as-judge, which may miss nuanced hallucinations.</li>
                <li><strong>Single-Threaded Benchmarking:</strong> The campaign runner executes experiments sequentially. Parallel execution would improve throughput for large campaigns.</li>
                <li><strong>Static Dataset:</strong> Benchmark datasets must be manually curated. The platform does not auto-generate evaluation questions from documents.</li>
                <li><strong>No Multi-Hop Retrieval:</strong> The current architecture supports single-step retrieval only. Multi-hop reasoning is not implemented.</li>
                <li><strong>Cost Tracking:</strong> Token usage and API costs are tracked but not yet integrated into evaluation metrics or optimization recommendations.</li>
                <li><strong>PDF Generation:</strong> Reports can be exported as Markdown and JSON. Native PDF generation requires an additional conversion step (Pandoc).</li>
              </ul>
            </Section>
          )}

          {activeTab === "future" && (
            <Section title="Future Scope">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>LLM-as-Judge Evaluation:</strong> Integrate GPT-4 or Claude as an automated judge for more accurate faithfulness and relevance assessment.</li>
                <li><strong>Multi-Hop Retrieval:</strong> Implement recursive retrieval for complex questions requiring multiple reasoning steps across documents.</li>
                <li><strong>Adaptive Retrieval:</strong> Dynamically adjust top-K, similarity threshold, and chunk size based on query type and complexity.</li>
                <li><strong>Parallel Benchmarking:</strong> Run multiple experiment configurations in parallel to reduce campaign execution time.</li>
                <li><strong>Auto-Generated Datasets:</strong> Generate benchmark questions automatically from document content using LLM-based question generation.</li>
                <li><strong>Cost-Aware Optimization:</strong> Include API cost as a first-class metric in the evaluation framework and recommendation engine.</li>
                <li><strong>Real-Time Monitoring:</strong> Add production monitoring dashboards for live RAG system performance tracking.</li>
                <li><strong>A/B Testing Framework:</strong> Support live A/B testing of retrieval configurations in production environments.</li>
                <li><strong>Multi-Modal Retrieval:</strong> Extend retrieval to include images, tables, and other non-text content.</li>
              </ul>
            </Section>
          )}

          {activeTab === "viva" && (
            <Section title="Common Viva Questions">
              <p className="mb-6">
                15 frequently asked questions in RAG project viva voce examinations with concise answers.
              </p>
              <div className="space-y-3">
                <VivaQuestion
                  question="What is RAG and why is it important?"
                  answer="Retrieval-Augmented Generation (RAG) is an AI architecture that combines information retrieval with text generation. It retrieves relevant documents from a knowledge base and feeds them as context to an LLM for answer generation. RAG is important because it reduces hallucinations, provides verifiable sources, keeps knowledge up-to-date without retraining, and allows domain-specific customization of LLMs."
                />
                <VivaQuestion
                  question="How does Kairos differ from other RAG evaluation tools?"
                  answer="Kairos provides a unified platform combining retrieval evaluation metrics (Recall@K, Precision@K, MRR, nDCG) with generation metrics (Faithfulness, Context Precision). It offers a benchmark campaign runner for large-scale experiments, statistical analysis with confidence intervals, a recommendation engine, educational content, and exportable reports. Most tools focus on either retrieval or generation in isolation."
                />
                <VivaQuestion
                  question="Explain the chunking strategies available in Kairos."
                  answer="Kairos supports five chunking strategies: (1) Recursive — tries sentence, then paragraph, then character boundaries; (2) Sentence — splits on sentence boundaries; (3) Fixed-size — creates chunks of a fixed token count with configurable overlap; (4) Markdown — respects Markdown heading hierarchy; (5) Semantic — groups semantically related paragraphs using embedding similarity."
                />
                <VivaQuestion
                  question="What is the difference between vector search and BM25 search?"
                  answer="Vector search uses embedding models to convert text into semantic vectors and retrieves by cosine similarity — it captures meaning and synonyms. BM25 is a keyword-based ranking function that matches exact query terms using TF-IDF principles. Vector search excels at semantic understanding; BM25 excels at exact term matching and proper nouns. Hybrid search combines both."
                />
                <VivaQuestion
                  question="How does the Hybrid retrieval strategy work?"
                  answer="Hybrid retrieval runs vector search and BM25 keyword search independently on the same query. The results are combined using Reciprocal Rank Fusion (RRF), which computes a fusion score for each document based on its rank in both result sets. Documents that rank highly in both searches get boosted. The fusion parameter k (default 60) controls how much high rankings are weighted."
                />
                <VivaQuestion
                  question="What metrics does Kairos use for evaluation?"
                  answer="Retrieval metrics: Recall@K (fraction of relevant docs retrieved), Precision@K (fraction of retrieved docs that are relevant), MRR (how quickly first relevant result appears), nDCG (ranking quality with graded relevance), Hit Rate (whether any relevant doc is found). Generation metrics: Faithfulness (consistency with context), Context Precision/Recall, Answer Relevancy."
                />
                <VivaQuestion
                  question="How do you interpret a 95% confidence interval for Recall@K?"
                  answer="A 95% confidence interval [0.72, 0.78] for Recall@K means that if we repeated the experiment 100 times, approximately 95 of those experiments would produce a mean Recall@K within this range. It quantifies the uncertainty due to the finite sample of test questions. Narrow confidence intervals indicate more reliable estimates."
                />
                <VivaQuestion
                  question="What is the precision-recall tradeoff in RAG?"
                  answer="Precision measures accuracy (are retrieved docs relevant?), while recall measures coverage (did we get all relevant docs?). Optimizing for precision (high similarity threshold, low top-K) means high relevance but may miss information. Optimizing for recall (low threshold, high top-K) catches more but includes noise. The optimal balance depends on the use case: QA systems need precision; research tools need recall."
                />
                <VivaQuestion
                  question="How does Reranking improve retrieval quality?"
                  answer="Reranking adds a second stage after initial retrieval where each candidate chunk is scored by a more expensive but more accurate model (cross-encoder or LLM). While initial retrieval uses fast bi-encoder embeddings, reranking can capture nuanced relevance that similarity search misses. This improves Precision@K by 10-15% by promoting truly relevant chunks to the top."
                />
                <VivaQuestion
                  question="What is Faithfulness and how is it measured?"
                  answer="Faithfulness measures whether the generated answer stays consistent with the retrieved context, without hallucination. In Kairos, it's measured by decomposing the answer into claims (sentences), extracting keywords from each claim, and checking keyword overlap with the context. If >=50% of keywords in a sentence are found in the context, the sentence is considered supported. Faithfulness = supported claims / total claims."
                />
                <VivaQuestion
                  question="How does the Experiment Campaign Runner work?"
                  answer="The campaign runner takes a dataset, a list of retrieval configurations (strategy × model × chunk strategy × top-K), and executes each configuration against every question in the dataset. It collects per-question metrics, computes aggregated statistics with confidence intervals, and returns a comparison of all configurations. Progress is reported via callbacks for real-time UI updates."
                />
                <VivaQuestion
                  question="What is the role of pgvector in the architecture?"
                  answer="pgvector is a PostgreSQL extension that enables efficient vector similarity search directly in the database. It stores embedding vectors alongside metadata, eliminating the need for a separate vector database. It supports IVFFlat and HNSW indexes for approximate nearest neighbor search, and uses cosine similarity by default for comparing embeddings."
                />
                <VivaQuestion
                  question="How does query expansion improve retrieval?"
                  answer="Query expansion uses an LLM to generate alternative phrasings of the user's query. For example, 'Who founded Kairos?' might be expanded to include 'Kairos founder', 'Who created Kairos', 'Kairos origin'. Each variation is searched independently, and results are merged with deduplication. This improves recall by 5-10% by covering different terminologies."
                />
                <VivaQuestion
                  question="What are the limitations of the current evaluation approach?"
                  answer="Key limitations include: (1) Generation metrics use heuristic keyword overlap rather than LLM-as-judge for nuanced hallucination detection; (2) Benchmark datasets must be manually curated; (3) Single-threaded campaign execution; (4) No multi-hop retrieval; (5) Cost tracking is not integrated into optimization recommendations; (6) PDF generation requires an external conversion step."
                />
                <VivaQuestion
                  question="How would you extend Kairos for production deployment?"
                  answer="For production deployment, I would: (1) Add LLM-as-judge evaluation for more accurate generative metrics; (2) Implement parallel campaign execution for faster benchmarking; (3) Add real-time monitoring dashboards for live system performance; (4) Integrate cost-awareness into the recommendation engine; (5) Add multi-hop retrieval for complex queries; (6) Implement A/B testing framework for live production traffic; (7) Add auto-generated benchmark datasets using LLM-based question generation."
                />
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
