"use client";

import Link from "next/link";
import {
  Microscope,
  FolderOpen,
  FileText,
  FlaskConical,
  BarChart3,
  MessageSquare,
  Upload,
  Sparkles,
  Zap,
  GitBranch,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardCard, CardSectionHeader, CardSectionTitle, CardSectionLink } from "@/components/app/dashboard/dashboard-card";
import { StatCard } from "@/components/app/dashboard/stat-card";
import { ActivityFeed } from "@/components/app/dashboard/activity-feed";
import { SystemHealth } from "@/components/app/dashboard/system-health";
import { InsightsPanel } from "@/components/app/dashboard/insights-panel";
import { PipelineStatus, IdlePipeline } from "@/components/app/dashboard/pipeline-status";
import { RecentWork } from "@/components/app/dashboard/recent-work";
import { SmartEmptyState } from "@/components/app/dashboard/smart-empty-state";
import { ProgressRing } from "@/components/ui/progress";

interface DashboardData {
  knowledgeBases: Array<{
    id: string;
    name: string;
    _count: { documents: number };
  }>;
  docCount: number;
  chunkCount: number;
  experimentCount: number;
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
  color = "text-brand",
  shortcut,
}: {
  href: string;
  icon: typeof FolderOpen;
  title: string;
  description: string;
  color?: string;
  shortcut?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-6 text-center transition-all hover:border-brand/30 hover:bg-brand/5 hover:shadow-lg hover:shadow-brand/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-surface-hover group-hover:bg-brand/10 transition-colors"
      )}>
        <Icon size={24} className={cn(color, "group-hover:text-brand transition-colors")} />
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

export function DashboardClient({ data }: DashboardClientProps) {
  const { knowledgeBases, docCount, chunkCount, experimentCount, latestBenchmark } = data;

  const hasKb = knowledgeBases.length > 0;
  const hasDocs = docCount > 0;
  const hasChunks = chunkCount > 0;
  const hasExperiments = experimentCount > 0;
  const hasBenchmark = latestBenchmark !== null;

  const healthScore = Math.round(
    ((hasKb ? 20 : 0) + (hasDocs ? 20 : 0) + (hasChunks ? 20 : 0) + (hasExperiments ? 20 : 0) + (hasBenchmark ? 20 : 0))
  );

  const benchmarkMetrics = latestBenchmark?.aggregatedMetrics as Record<string, number> | null;
  const avgRecall = benchmarkMetrics?.avgRecallAtK ?? null;

  // Build recent work items from real data
  const recentWorkItems = [
    ...knowledgeBases.slice(0, 3).map((kb) => ({
      id: kb.id,
      type: "kb" as const,
      name: kb.name,
      description: `${kb._count.documents} document${kb._count.documents !== 1 ? "s" : ""}`,
      href: `/app/knowledge-bases/${kb.id}`,
    })),
  ];

  // Show empty state if no knowledge bases
  if (!hasKb) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Hero Stats - even empty shows the structure */}
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-gradient-to-br from-surface via-surface to-brand/5 p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-brand/10">
                <Microscope size={20} className="text-brand" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary tracking-tight">Mission Control</h1>
                <p className="text-sm text-text-secondary">Your AI Research Command Center</p>
              </div>
            </div>
          </div>
        </div>

        <SmartEmptyState />

        {/* Quick Actions - always visible */}
        <DashboardCard variant="default">
          <CardSectionHeader>
            <CardSectionTitle>Quick Actions</CardSectionTitle>
          </CardSectionHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            <QuickActionCard href="/app/knowledge-bases" icon={Upload} title="Upload Document" description="Add files to a knowledge base" shortcut="U" />
            <QuickActionCard href="/app/knowledge-bases" icon={FolderOpen} title="Create Knowledge Base" description="Start a new knowledge base" color="text-blue-500" shortcut="N" />
            <QuickActionCard href="/app/rag-chat" icon={MessageSquare} title="Open RAG Chat" description="Ask questions about your docs" color="text-emerald-500" shortcut="R" />
            <QuickActionCard href="/app/evaluation" icon={BarChart3} title="Run Evaluation" description="Benchmark retrieval performance" color="text-violet-500" shortcut="E" />
          </div>
        </DashboardCard>

        {/* Insights for new users */}
        <DashboardCard variant="default">
          <CardSectionHeader>
            <CardSectionTitle className="flex items-center gap-2">
              <Sparkles size={14} className="text-brand" />
              Getting Started
            </CardSectionTitle>
          </CardSectionHeader>
          <InsightsPanel
            insights={[
              {
                id: "welcome",
                type: "info",
                title: "Welcome to Kairos",
                description: "Kairos is an AI Research Mission Control for RAG experiments. Start by creating a knowledge base and uploading your research documents.",
                action: { label: "Create Knowledge Base", href: "/app/knowledge-bases" },
              },
              {
                id: "learn",
                type: "suggestion",
                title: "New to RAG?",
                description: "Check out the Project Guide to understand Retrieval-Augmented Generation and how Kairos helps you research it.",
                action: { label: "Open Project Guide", href: "/app/project-guide" },
              },
            ]}
          />
        </DashboardCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Area: Intelligent Workspace Overview */}
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-gradient-to-br from-surface via-surface to-brand/5 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-brand/10">
              <Microscope size={20} className="text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">Mission Control</h1>
              <p className="text-sm text-text-secondary">Your AI Research Command Center</p>
            </div>
            <div className="ml-auto">
              <ProgressRing
                value={healthScore}
                size="md"
                color={healthScore >= 80 ? "success" : healthScore >= 50 ? "warning" : "error"}
              />
            </div>
          </div>

          {/* Stats Strip */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Knowledge Bases"
              value={knowledgeBases.length}
              icon={FolderOpen}
              status="brand"
            />
            <StatCard
              label="Documents"
              value={docCount}
              icon={FileText}
              status={hasDocs ? "success" : "default"}
            />
            <StatCard
              label="Chunks"
              value={chunkCount.toLocaleString()}
              icon={GitBranch}
              status={hasChunks ? "success" : "default"}
            />
            <StatCard
              label="Experiments"
              value={experimentCount}
              icon={FlaskConical}
              status={hasExperiments ? "success" : "default"}
              trend={avgRecall !== null ? "up" : undefined}
              trendValue={avgRecall !== null ? `${(avgRecall * 100).toFixed(0)}% recall` : undefined}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard href="/app/knowledge-bases" icon={Upload} title="Upload Document" description="Add files to a knowledge base" shortcut="U" />
        <QuickActionCard href="/app/rag-chat" icon={MessageSquare} title="Open RAG Chat" description="Ask questions about your docs" color="text-emerald-500" shortcut="R" />
        <QuickActionCard href="/app/evaluation" icon={BarChart3} title="Run Evaluation" description="Benchmark retrieval performance" color="text-violet-500" shortcut="E" />
        <QuickActionCard href="/app/copilot" icon={Sparkles} title="Ask Copilot" description="Get AI research insights" color="text-yellow-500" />
      </div>

      {/* Main Content Grid: 3-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Activity + Pipeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Activity */}
          <DashboardCard variant="default">
            <CardSectionHeader>
              <CardSectionTitle className="flex items-center gap-2">
                <Zap size={14} className="text-brand" />
                Live Activity
              </CardSectionTitle>
              <span className="text-[10px] text-text-tertiary">Real-time updates</span>
            </CardSectionHeader>
            <ActivityFeed maxItems={6} />
          </DashboardCard>

          {/* Pipeline Status */}
          <DashboardCard variant="default">
            <CardSectionHeader>
              <CardSectionTitle>Pipeline Status</CardSectionTitle>
              <Link href="/app/architecture" className="text-xs text-brand hover:text-brand-hover transition-colors">
                View Architecture
              </Link>
            </CardSectionHeader>
            <div className="mt-4">
              {hasDocs ? (
                <PipelineStatus
                  stages={[
                    { id: "upload", label: "Upload", icon: Upload, status: "completed" },
                    { id: "extract", label: "Extract", icon: FileText, status: "completed" },
                    { id: "chunk", label: "Chunk", icon: GitBranch, status: "completed" },
                    { id: "embed", label: "Embed", icon: Zap, status: hasChunks ? "completed" : "active" },
                    { id: "index", label: "Index", icon: FolderOpen, status: hasChunks ? "completed" : "pending" },
                    { id: "ready", label: "Ready", icon: Sparkles, status: hasExperiments ? "completed" : "pending" },
                  ]}
                />
              ) : (
                <IdlePipeline />
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Right Column: System Health + Insights */}
        <div className="space-y-6">
          {/* System Health */}
          <DashboardCard variant="default">
            <CardSectionHeader>
              <CardSectionTitle>System Health</CardSectionTitle>
            </CardSectionHeader>
            <SystemHealth />
          </DashboardCard>

          {/* Insights */}
          <DashboardCard variant="default">
            <CardSectionHeader>
              <CardSectionTitle className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand" />
                Insights
              </CardSectionTitle>
            </CardSectionHeader>
            <InsightsPanel />
          </DashboardCard>
        </div>
      </div>

      {/* Recent Work */}
      {recentWorkItems.length > 0 && (
        <DashboardCard variant="default">
          <CardSectionHeader>
            <CardSectionTitle>Recent Work</CardSectionTitle>
            <CardSectionLink href="/app/knowledge-bases">View all</CardSectionLink>
          </CardSectionHeader>
          <RecentWork items={recentWorkItems} maxItems={6} />
        </DashboardCard>
      )}

      {/* Knowledge Bases Quick Access */}
      {knowledgeBases.length > 0 && (
        <DashboardCard variant="default">
          <CardSectionHeader>
            <CardSectionTitle className="flex items-center gap-2">
              <BookOpen size={14} className="text-brand" />
              Knowledge Bases
            </CardSectionTitle>
            <CardSectionLink href="/app/knowledge-bases">View all</CardSectionLink>
          </CardSectionHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {knowledgeBases.slice(0, 6).map((kb) => (
              <Link
                key={kb.id}
                href={`/app/knowledge-bases/${kb.id}`}
                className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface/50 p-4 transition-all hover:border-border-hover hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate group-hover:text-brand transition-colors">
                    {kb.name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {kb._count.documents} document{kb._count.documents !== 1 ? "s" : ""}
                  </p>
                </div>
                <ArrowRight size={14} className="text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
