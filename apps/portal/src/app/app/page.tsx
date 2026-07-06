import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Layers,
  BarChart3,
} from "lucide-react";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { MetricCard } from "@/components/research/metric-card";
import { ResearchNote } from "@/components/research/research-note";
import { EmptyState } from "@/components/research/empty-state";
import { Pipeline } from "@/components/research/pipeline";
import { Button } from "@/components/ui/button";

const PIPELINE_STAGES = [
  { id: "documents", label: "Documents", icon: "FileText", color: "bg-blue-500" },
  { id: "chunking", label: "Chunking", icon: "Scissors", color: "bg-teal-500" },
  { id: "embeddings", label: "Embeddings", icon: "Database", color: "bg-emerald-500" },
  { id: "retrieval", label: "Retrieval", icon: "FlaskConical", color: "bg-yellow-500" },
  { id: "prompt", label: "Prompt", icon: "FileSearch", color: "bg-orange-500" },
  { id: "llm", label: "LLM", icon: "Cpu", color: "bg-purple-500" },
  { id: "evaluation", label: "Evaluation", icon: "BarChart3", color: "bg-violet-500" },
];

const quickActions = [
  { label: "Upload Documents", href: "/app/knowledge-bases", icon: "Upload" },
  { label: "Open Retrieval Lab", href: "/app/retrieval-lab", icon: "FlaskConical" },
  { label: "Run Evaluation", href: "/app/evaluation", icon: "BarChart3" },
  { label: "View Architecture", href: "/app/architecture", icon: "BookOpen" },
];

export default async function AppPage() {
  await requireSession();

  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  const [knowledgeBases, docCount, chunkCount, experimentCount, latestBenchmark] = await Promise.all([
    listKnowledgeBases(),
    prisma.document.count({
      where: { knowledgeBase: { projectId: project.id } },
    }),
    prisma.documentChunk.count({
      where: { document: { knowledgeBase: { projectId: project.id } } },
    }),
    prisma.experimentRun.count({
      where: { knowledgeBase: { projectId: project.id } },
    }),
    prisma.benchmarkRun.findFirst({
      where: { status: "completed", dataset: { knowledgeBase: { projectId: project.id } } },
      orderBy: { createdAt: "desc" },
      select: { name: true, createdAt: true, aggregatedMetrics: true },
    }),
  ]);

  const currentKb = knowledgeBases[0] ?? null;
  const currentConfig = currentKb
    ? (currentKb.retrievalConfig as Record<string, unknown> | null)
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Kairos</h1>
          <p className="mt-1 text-sm text-text-secondary max-w-2xl">
            Adaptive Retrieval-Augmented Generation Research Platform
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {quickActions.map((action) => (
            <Button key={action.href} variant="secondary" size="sm" asChild>
              <Link href={action.href}>
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Current Configuration */}
      {currentKb && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-4">
            <Cpu size={14} />
            Current Configuration
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-text-tertiary">Knowledge Base</span>
              <p className="text-sm font-medium text-text-primary truncate">{currentKb.name}</p>
              <p className="text-xs text-text-tertiary">{currentKb._count.documents} documents</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-text-tertiary">Retrieval Strategy</span>
              <p className="text-sm font-medium text-text-primary capitalize">
                {String(currentConfig?.retrievalMode ?? currentConfig?.retrievalStrategy ?? "vector")}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-text-tertiary">Embedding Model</span>
              <p className="text-sm font-medium text-text-primary">
                {String(currentConfig?.embeddingModel ?? "—")}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-text-tertiary">Chunking Strategy</span>
              <p className="text-sm font-medium text-text-primary capitalize">
                {String(currentConfig?.chunkStrategy ?? "—")}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-text-tertiary">Last Benchmark</span>
              <p className="text-sm font-medium text-text-primary">
                {latestBenchmark ? new Date(latestBenchmark.createdAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-4">
          <Layers size={14} />
          RAG Pipeline
        </div>
        <Pipeline stages={PIPELINE_STAGES} size="md" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Knowledge Bases"
          value={String(knowledgeBases.length)}
          icon="BookOpen"
          description="Total knowledge bases"
        />
        <MetricCard
          label="Documents"
          value={String(docCount)}
          icon="FileText"
          description="Uploaded documents"
        />
        <MetricCard
          label="Chunks"
          value={String(chunkCount)}
          icon="Layers"
          description="Document segments"
        />
        <MetricCard
          label="Experiments"
          value={String(experimentCount)}
          icon="BarChart3"
          description="Total experiment runs"
        />
      </div>

      {/* Latest Benchmark */}
      {latestBenchmark && latestBenchmark.aggregatedMetrics && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-4">
            <BarChart3 size={14} />
            Latest Benchmark — {latestBenchmark.name ?? "Unnamed"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(latestBenchmark.aggregatedMetrics as Record<string, number>)
              .filter(([k]) => k.startsWith("avg") && k !== "avgLatencyMs")
              .slice(0, 10)
              .map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <span className="text-xs text-text-tertiary">{key.replace("avg", "Avg ")}</span>
                  <p className="text-lg font-semibold text-text-primary font-mono">
                    {(val as number).toFixed(4)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* What is RAG? */}
      <ResearchNote title="About RAG">
        <strong className="text-text-primary">Retrieval-Augmented Generation (RAG)</strong> is an AI architecture
        that combines information retrieval with text generation. Instead of relying solely on a model&apos;s
        parametric knowledge, RAG retrieves relevant documents from a knowledge base and provides them as context
        to the language model. This addresses key limitations of LLMs: hallucination, stale knowledge, and lack of
        source transparency.
      </ResearchNote>

      {/* Knowledge Bases Quick List */}
      {knowledgeBases.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Knowledge Bases</h2>
            <Link
              href="/app/knowledge-bases"
              className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {knowledgeBases.slice(0, 6).map((kb) => (
              <Link
                key={kb.id}
                href={`/app/knowledge-bases/${kb.id}`}
                className="group rounded-lg border border-border bg-surface/50 p-4 transition-all duration-200 hover:border-border-hover hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary truncate">{kb.name}</p>
                  <ArrowRight size={14} className="text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  {kb._count.documents} document{kb._count.documents !== 1 ? "s" : ""}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {knowledgeBases.length === 0 && (
        <EmptyState
          icon="BookOpen"
          title="No knowledge bases yet"
          description="Create your first knowledge base to start uploading documents and building retrieval systems."
          actionHref="/app/knowledge-bases"
          actionLabel="Create knowledge base"
        />
      )}
    </div>
  );
}
