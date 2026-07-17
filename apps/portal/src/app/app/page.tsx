import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowRight,
  Microscope,
  Sparkles,
  GitBranch,
  BarChart3,
  BookOpen,
  FolderOpen,
  FlaskConical,
  Zap,
} from "lucide-react";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { ResearchNote } from "@/components/research/research-note";
import { Pipeline } from "@/components/research/pipeline";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { PremiumCard, CardHeader, CardTitle, CardDescription } from "@/components/ui/premium-card";
import { MetricCard } from "@/components/ui/metric-display";
import { ProgressRing, ProgressBar } from "@/components/ui/progress";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";

const PIPELINE_STAGES = [
  { id: "documents", label: "Documents", icon: "FileText", color: "bg-blue-500" },
  { id: "chunking", label: "Chunking", icon: "Scissors", color: "bg-teal-500" },
  { id: "embeddings", label: "Embeddings", icon: "Database", color: "bg-emerald-500" },
  { id: "retrieval", label: "Retrieval", icon: "FlaskConical", color: "bg-yellow-500" },
  { id: "prompt", label: "Prompt", icon: "FileSearch", color: "bg-orange-500" },
  { id: "llm", label: "LLM", icon: "Cpu", color: "bg-purple-500" },
  { id: "evaluation", label: "Evaluation", icon: "BarChart3", color: "bg-violet-500" },
];

export default async function AppPage() {
  let project: { id: string } | null = null;

  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (result) project = result.project;
  } catch {
    // Seed data not yet initialized — render empty dashboard
  }

  let knowledgeBases: Awaited<ReturnType<typeof listKnowledgeBases>> = [];
  let docCount = 0;
  let chunkCount = 0;
  let experimentCount = 0;
  let latestBenchmark: {
    name: string | null;
    createdAt: Date;
    aggregatedMetrics: import("@prisma/client").Prisma.JsonValue | null;
  } | null = null;

  try {
    if (project) {
      [knowledgeBases, docCount, chunkCount, experimentCount, latestBenchmark] = await Promise.all([
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
    }
  } catch {
    // Dashboard will render with empty/default data
  }

  const currentKb = knowledgeBases[0] ?? null;
  const currentConfig = currentKb
    ? (currentKb.retrievalConfig as Record<string, unknown> | null)
    : null;

  // Calculate research health score
  const hasKb = knowledgeBases.length > 0;
  const hasDocs = docCount > 0;
  const hasChunks = chunkCount > 0;
  const hasExperiments = experimentCount > 0;
  const hasBenchmark = latestBenchmark !== null;

  const healthScore = Math.round(
    ((hasKb ? 20 : 0) + (hasDocs ? 20 : 0) + (hasChunks ? 20 : 0) + (hasExperiments ? 20 : 0) + (hasBenchmark ? 20 : 0))
  );

  // Build timeline steps
  const timelineSteps: TimelineStep[] = [
    { id: "kb", label: "Knowledge Base", status: hasKb ? "completed" : "current", description: hasKb ? `${knowledgeBases.length} created` : "Create your first KB" },
    { id: "docs", label: "Documents", status: hasDocs ? "completed" : hasKb ? "current" : "upcoming", description: hasDocs ? `${docCount} uploaded` : "Upload documents" },
    { id: "chunks", label: "Chunking", status: hasChunks ? "completed" : hasDocs ? "current" : "upcoming", description: hasChunks ? `${chunkCount} chunks` : "Configure chunking" },
    { id: "experiments", label: "Experiments", status: hasExperiments ? "completed" : hasChunks ? "current" : "upcoming", description: hasExperiments ? `${experimentCount} runs` : "Run experiments" },
    { id: "benchmark", label: "Benchmark", status: hasBenchmark ? "completed" : hasExperiments ? "current" : "upcoming", description: hasBenchmark ? "Completed" : "Run benchmark" },
  ];

  // Extract benchmark metrics
  const benchmarkMetrics = latestBenchmark?.aggregatedMetrics as Record<string, number> | null;
  const avgRecall = benchmarkMetrics?.avgRecallAtK ?? null;
  const avgPrecision = benchmarkMetrics?.avgPrecisionAtK ?? null;
  const avgMrr = benchmarkMetrics?.avgMrr ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Research Overview"
        description="Your RAG research command center"
        purpose="Your central command center for RAG research experiments."
        nextAction={{ label: "New Experiment", href: "/app/experiment-builder" }}
        relatedPages={[
          { label: "Research Dashboard", href: "/app/research" },
          { label: "Retrieval Lab", href: "/app/retrieval-lab" },
          { label: "Evaluation", href: "/app/evaluation" },
        ]}
      />
      {/* Hero Greeting */}
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-gradient-to-br from-surface via-surface to-brand/5 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-brand/10">
              <Microscope size={20} className="text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">Research Dashboard</h1>
              <p className="text-sm text-text-secondary">Your RAG research command center</p>
            </div>
          </div>

          {/* Today's Research Brief */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-lg)] bg-surface/50 border border-border/50 p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Knowledge Bases</p>
              <p className="text-2xl font-bold text-text-primary tabular-nums">{knowledgeBases.length}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] bg-surface/50 border border-border/50 p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Documents</p>
              <p className="text-2xl font-bold text-text-primary tabular-nums">{docCount}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] bg-surface/50 border border-border/50 p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Chunks</p>
              <p className="text-2xl font-bold text-text-primary tabular-nums">{chunkCount.toLocaleString()}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] bg-surface/50 border border-border/50 p-4">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Experiments</p>
              <p className="text-2xl font-bold text-text-primary tabular-nums">{experimentCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Research Health & Timeline Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Research Health */}
        <PremiumCard variant="elevated">
          <CardHeader icon={<Zap size={16} />}>
            <CardTitle>Research Health</CardTitle>
          </CardHeader>
          <div className="flex items-center justify-around py-4">
            <ProgressRing value={healthScore} label="Overall" color={healthScore >= 80 ? "success" : healthScore >= 50 ? "warning" : "error"} />
            <div className="space-y-3">
              <ProgressBar value={hasKb ? 100 : 0} label="Knowledge Base" color={hasKb ? "success" : "error"} />
              <ProgressBar value={hasDocs ? 100 : 0} label="Documents" color={hasDocs ? "success" : "error"} />
              <ProgressBar value={hasExperiments ? 100 : 0} label="Experiments" color={hasExperiments ? "success" : "error"} />
              <ProgressBar value={hasBenchmark ? 100 : 0} label="Benchmarks" color={hasBenchmark ? "success" : "error"} />
            </div>
          </div>
        </PremiumCard>

        {/* Research Timeline */}
        <PremiumCard variant="elevated" className="lg:col-span-2">
          <CardHeader icon={<GitBranch size={16} />}>
            <CardTitle>Research Progress</CardTitle>
            <CardDescription>Track your RAG research journey</CardDescription>
          </CardHeader>
          <div className="py-4">
            <Timeline steps={timelineSteps} />
          </div>
        </PremiumCard>
      </div>

      {/* Current Configuration & Latest Benchmark */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Configuration */}
        {currentKb && (
          <PremiumCard variant="elevated">
            <CardHeader icon={<FolderOpen size={16} />}>
              <CardTitle>Current Configuration</CardTitle>
              <Link href="/app/settings" className="text-xs text-brand hover:text-brand-hover transition-colors">
                Configure
              </Link>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-text-tertiary">Knowledge Base</span>
                <span className="text-sm font-medium text-text-primary">{currentKb.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-text-tertiary">Retrieval</span>
                <span className="text-sm font-medium text-text-primary capitalize">
                  {String(currentConfig?.retrievalMode ?? currentConfig?.retrievalStrategy ?? "vector")}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-text-tertiary">Embedding</span>
                <span className="text-sm font-medium text-text-primary">
                  {String(currentConfig?.embeddingModel ?? "—")}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-text-tertiary">Chunking</span>
                <span className="text-sm font-medium text-text-primary capitalize">
                  {String(currentConfig?.chunkStrategy ?? "—")}
                </span>
              </div>
            </div>
          </PremiumCard>
        )}

        {/* Latest Benchmark */}
        <PremiumCard variant="elevated">
          <CardHeader icon={<BarChart3 size={16} />}>
            <CardTitle>Latest Benchmark</CardTitle>
            {latestBenchmark && (
              <span className="text-xs text-text-tertiary">
                {new Date(latestBenchmark.createdAt).toLocaleDateString()}
              </span>
            )}
          </CardHeader>
          {benchmarkMetrics ? (
            <div className="space-y-4">
              {avgRecall !== null && (
                <MetricCard
                  label="Recall@K"
                  value={(avgRecall * 100).toFixed(1)}
                  unit="%"
                  status={avgRecall >= 0.8 ? "excellent" : avgRecall >= 0.6 ? "good" : "warning"}
                />
              )}
              {avgPrecision !== null && (
                <MetricCard
                  label="Precision@K"
                  value={(avgPrecision * 100).toFixed(1)}
                  unit="%"
                  status={avgPrecision >= 0.7 ? "excellent" : avgPrecision >= 0.5 ? "good" : "warning"}
                />
              )}
              {avgMrr !== null && (
                <MetricCard
                  label="MRR"
                  value={(avgMrr * 100).toFixed(1)}
                  unit="%"
                  status={avgMrr >= 0.7 ? "excellent" : avgMrr >= 0.5 ? "good" : "warning"}
                />
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-text-tertiary">No benchmark data yet</p>
              <Button variant="secondary" size="sm" className="mt-3" asChild>
                <Link href="/app/evaluation">Run Evaluation</Link>
              </Button>
            </div>
          )}
        </PremiumCard>
      </div>

      {/* Quick Actions */}
      <PremiumCard variant="glass">
        <CardHeader icon={<Sparkles size={16} />}>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/app/knowledge-bases"
            className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-4 transition-all hover:border-brand/30 hover:bg-brand/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-brand/10 group-hover:bg-brand/20 transition-colors">
              <FolderOpen size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Upload Documents</p>
              <p className="text-xs text-text-tertiary">Add to knowledge base</p>
            </div>
          </Link>
          <Link
            href="/app/retrieval-lab"
            className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-4 transition-all hover:border-brand/30 hover:bg-brand/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-brand/10 group-hover:bg-brand/20 transition-colors">
              <FlaskConical size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Retrieval Lab</p>
              <p className="text-xs text-text-tertiary">Test configurations</p>
            </div>
          </Link>
          <Link
            href="/app/evaluation"
            className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-4 transition-all hover:border-brand/30 hover:bg-brand/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-brand/10 group-hover:bg-brand/20 transition-colors">
              <BarChart3 size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Run Evaluation</p>
              <p className="text-xs text-text-tertiary">Benchmark performance</p>
            </div>
          </Link>
          <Link
            href="/app/copilot"
            className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-4 transition-all hover:border-brand/30 hover:bg-brand/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-brand/10 group-hover:bg-brand/20 transition-colors">
              <Sparkles size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">AI Copilot</p>
              <p className="text-xs text-text-tertiary">Get research insights</p>
            </div>
          </Link>
        </div>
      </PremiumCard>

      {/* RAG Pipeline */}
      <PremiumCard variant="elevated">
        <CardHeader icon={<Zap size={16} />}>
          <CardTitle>RAG Pipeline</CardTitle>
          <Link href="/app/architecture" className="text-xs text-brand hover:text-brand-hover transition-colors">
            View Details
          </Link>
        </CardHeader>
        <Pipeline stages={PIPELINE_STAGES} size="md" />
      </PremiumCard>

      {/* Knowledge Bases */}
      {knowledgeBases.length > 0 && (
        <PremiumCard variant="elevated">
          <CardHeader icon={<BookOpen size={16} />}>
            <CardTitle>Knowledge Bases</CardTitle>
            <Link href="/app/knowledge-bases" className="text-xs text-brand hover:text-brand-hover transition-colors">
              View all
            </Link>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {knowledgeBases.slice(0, 6).map((kb) => (
              <Link
                key={kb.id}
                href={`/app/knowledge-bases/${kb.id}`}
                className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface/50 p-4 transition-all hover:border-border-hover hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{kb.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {kb._count.documents} document{kb._count.documents !== 1 ? "s" : ""}
                  </p>
                </div>
                <ArrowRight size={14} className="text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        </PremiumCard>
      )}

      {/* Empty State */}
      {knowledgeBases.length === 0 && (
        <PremiumCard variant="elevated" padding="lg">
          <div className="text-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-brand/10 mx-auto mb-4">
              <BookOpen size={32} className="text-brand" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Welcome to Kairos</h3>
            <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
              Start your RAG research journey by creating a knowledge base and uploading documents.
            </p>
            <Button variant="primary" className="mt-6" asChild>
              <Link href="/app/knowledge-bases">Create Knowledge Base</Link>
            </Button>
          </div>
        </PremiumCard>
      )}

      {/* About RAG */}
      <ResearchNote title="About RAG">
        <strong className="text-text-primary">Retrieval-Augmented Generation (RAG)</strong> is an AI architecture
        that combines information retrieval with text generation. Instead of relying solely on a model&apos;s
        parametric knowledge, RAG retrieves relevant documents from a knowledge base and provides them as context
        to the language model. This addresses key limitations of LLMs: hallucination, stale knowledge, and lack of
        source transparency.
      </ResearchNote>
    </div>
  );
}
