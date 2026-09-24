"use client";

import Link from "next/link";
import {
  FolderOpen,
  FileText,
  FlaskConical,
  MessageSquare,
  BarChart3,
  ArrowRight,
  Upload,
  Layers,
  ListChecks,
} from "lucide-react";
import { DashboardCard, CardSectionHeader, CardSectionTitle, CardSectionLink } from "@/components/app/dashboard/dashboard-card";
import { StatCard } from "@/components/app/dashboard/stat-card";
import { kbWorkspaceHref } from "@/components/app/kb-workspace-tabs";

interface DashboardData {
  knowledgeBases: Array<{
    id: string;
    name: string;
    _count: { documents: number };
  }>;
  docCount: number;
  chunkCount: number;
  experimentCount: number;
  quizzesTaken: number;
  cardsKnown: number;
  latestBenchmark: {
    name: string | null;
    createdAt: Date;
    aggregatedMetrics: Record<string, number> | null;
  } | null;
}

interface DashboardClientProps {
  data: DashboardData;
}

function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
  shortcut,
}: {
  href: string;
  icon: typeof FolderOpen;
  title: string;
  description: string;
  shortcut?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-6 text-center transition-all hover:border-brand/30 hover:bg-brand/5 hover:shadow-lg hover:shadow-brand/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-surface-hover group-hover:bg-brand/10 transition-colors">
        <Icon size={24} className="text-brand transition-colors" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary group-hover:text-brand transition-colors">
          {title}
        </p>
        <p className="text-xs text-text-tertiary mt-1">{description}</p>
      </div>
      {shortcut && (
        <kbd className="absolute top-3 right-3 rounded border border-border bg-bg px-1.5 py-0.5 text-[9px] font-mono text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
          {shortcut}
        </kbd>
      )}
      <ArrowRight
        size={16}
        className="absolute bottom-3 right-3 text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
      />
    </Link>
  );
}

const WORKSPACE_LINKS: { label: string; href: (kbId: string) => string }[] = [
  { label: "Sources", href: (kbId) => kbWorkspaceHref(kbId, "sources") },
  { label: "Research", href: (kbId) => kbWorkspaceHref(kbId, "research") },
  { label: "Studio", href: (kbId) => kbWorkspaceHref(kbId, "studio") },
  { label: "Study", href: (kbId) => kbWorkspaceHref(kbId, "study") },
];

export function DashboardClient({ data }: DashboardClientProps) {
  const { knowledgeBases, docCount, chunkCount, experimentCount, latestBenchmark, quizzesTaken, cardsKnown } = data;

  const hasKb = knowledgeBases.length > 0;
  const hasDocs = docCount > 0;

  const benchmarkMetrics = latestBenchmark?.aggregatedMetrics;
  const avgRecall =
    benchmarkMetrics && typeof benchmarkMetrics.avgRecallAtK === "number"
      ? benchmarkMetrics.avgRecallAtK
      : null;

  if (!hasKb) {
    return (
      <div className="space-y-6 animate-fade-in">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Research workspace</h1>
            <p className="page-description mt-1">Start by building a knowledge base from your documents.</p>
          </div>
        </header>

        <DashboardCard variant="default">
          <CardSectionHeader>
            <CardSectionTitle>Get started</CardSectionTitle>
          </CardSectionHeader>
          <div className="mt-4 min-w-0 space-y-3">
            {[
              { text: "Create a knowledge base and upload your research documents.", href: "/app/knowledge-bases" },
              { text: "Ask questions against those documents with grounded citations.", href: "/app/knowledge-bases" },
              { text: "Build retrieval experiments and benchmark them.", href: "/app/evaluation" },
            ].map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className="group flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-3 transition-all hover:border-border-hover hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {i + 1}
                </span>
                <span className="text-sm text-text-secondary group-hover:text-brand transition-colors">{step.text}</span>
              </Link>
            ))}
          </div>
        </DashboardCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Research workspace</h1>
          <p className="page-description mt-1">
            {knowledgeBases.length} knowledge base{knowledgeBases.length !== 1 ? "s" : ""},{" "}
            {docCount} document{docCount !== 1 ? "s" : ""}, {chunkCount.toLocaleString()} chunks.
          </p>
        </div>
        <Link
          href="/app/knowledge-bases"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary sm:flex"
        >
          <FolderOpen size={14} />
          Knowledge Bases
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Knowledge Bases" value={knowledgeBases.length} icon={FolderOpen} status="brand" />
        <StatCard label="Documents" value={docCount} icon={FileText} status={hasDocs ? "success" : "default"} />
        <StatCard label="Chunks" value={chunkCount.toLocaleString()} icon={Layers} status={chunkCount > 0 ? "success" : "default"} />
        <StatCard label="Experiments" value={experimentCount} icon={FlaskConical} status={experimentCount > 0 ? "success" : "default"} trend={avgRecall !== null ? "up" : undefined} trendValue={avgRecall !== null ? `${(avgRecall * 100).toFixed(0)}% recall` : undefined} />
        <StatCard label="Quizzes Taken" value={quizzesTaken} icon={ListChecks} status={quizzesTaken > 0 ? "success" : "default"} />
        <StatCard label="Cards Known" value={cardsKnown} icon={Layers} status={cardsKnown > 0 ? "success" : "default"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard href="/app/knowledge-bases" icon={Upload} title="Upload Document" description="Add files to a knowledge base" shortcut="U" />
        <QuickActionCard href="/app/knowledge-bases" icon={MessageSquare} title="Open Chat" description="Ask questions about your docs" shortcut="R" />
        <QuickActionCard href="/app/experiment-builder" icon={FlaskConical} title="New Experiment" description="Build a retrieval experiment" />
        <QuickActionCard href="/app/evaluation" icon={BarChart3} title="Run Evaluation" description="Benchmark retrieval performance" shortcut="E" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <DashboardCard variant="default">
            <CardSectionHeader>
              <CardSectionTitle className="flex items-center gap-2">
                <FolderOpen size={14} className="text-brand" />
                Knowledge Bases
              </CardSectionTitle>
              <CardSectionLink href="/app/knowledge-bases">View all</CardSectionLink>
            </CardSectionHeader>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {knowledgeBases.slice(0, 6).map((kb) => (
                <div
                  key={kb.id}
                  className="rounded-[var(--radius-lg)] border border-border bg-surface/50 p-4 transition-all hover:border-border-hover hover:bg-surface-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{kb.name}</p>
                      <p className="text-xs text-text-tertiary mt-1">
                        {kb._count.documents} document{kb._count.documents !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-text-tertiary" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {WORKSPACE_LINKS.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href(kb.id)}
                        className="rounded-[var(--radius-md)] border border-border bg-bg px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-brand/30 hover:text-brand"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        <div className="space-y-6">
          <DashboardCard variant="default">
            <CardSectionHeader>
              <CardSectionTitle>Study progress</CardSectionTitle>
            </CardSectionHeader>
            {quizzesTaken > 0 || cardsKnown > 0 ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Quizzes taken</span>
                  <span className="font-semibold text-text-primary">{quizzesTaken}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Cards known</span>
                  <span className="font-semibold text-text-primary">{cardsKnown}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-tertiary">
                No study activity yet. Open a knowledge base and start studying.
              </p>
            )}
            {hasKb && (
              <Link
                href={kbWorkspaceHref(knowledgeBases[0].id, "study")}
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover transition-colors"
              >
                Open Study
                <ArrowRight size={12} />
              </Link>
            )}
          </DashboardCard>

          <DashboardCard variant="default">
            <CardSectionHeader>
              <CardSectionTitle>Latest evaluation</CardSectionTitle>
            </CardSectionHeader>
            {latestBenchmark ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-sm font-medium text-text-primary truncate">{latestBenchmark.name ?? "Benchmark run"}</p>
                <p className="text-xs text-text-tertiary">
                  {latestBenchmark.createdAt.toLocaleDateString()}
                </p>
                {avgRecall !== null && (
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Avg recall@k</span>
                      <span className="font-semibold text-text-primary">{(avgRecall * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${Math.min(avgRecall * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-tertiary">
                No evaluations yet. Run one to see retrieval metrics here.
              </p>
            )}
            <Link
              href="/app/evaluation"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover transition-colors"
            >
              Open Evaluation
              <ArrowRight size={12} />
            </Link>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}