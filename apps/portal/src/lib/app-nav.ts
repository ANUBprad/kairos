import {
  LayoutDashboard,
  FolderOpen,
  Microscope,
  Sparkles,
  GraduationCap,
  GitBranch,
  Lightbulb,
  FileText,
  Code2,
  FlaskConical,
  Search,
  BarChart3,
  Bot,
  BookOpen,
  SlidersHorizontal,
  Eye,
  Activity,
  Radio,
  DollarSign,
  AlertTriangle,
  Layers,
  CircleDot,
  HardDrive,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for the app's main navigation: the sidebar, the
// command palette and the page breadcrumbs all read from here instead of
// maintaining three divergent copies of the same list.
export interface AppNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  keywords?: string[];
}

export interface AppNavSection {
  label: string;
  items: AppNavItem[];
  // Advanced sections collapse by default so the sidebar reads as the core
  // research journey (Home / Library / Research / Studio / Study) rather than
  // an engineering control panel. Every route stays reachable.
  defaultCollapsed?: boolean;
}

// The workspace journey first, then the advanced tooling folded away.
//
// Workspace — the product: where you bring sources, research them, create
// artifacts and study them.
// Evaluate — datasets, experiments and retrieval tooling for measuring quality.
// Observe — operational telemetry for operators, not the default experience.
// Settings — configuration and reference material.
//
// Only grouping and ordering are expressed here; every route below predates
// this file, so deep links keep working and the command palette (FLAT_APP_NAV)
// still indexes everything.
export const APP_NAV: AppNavSection[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Home",
        href: "/app",
        icon: LayoutDashboard,
        description: "Your work at a glance",
        keywords: ["dashboard", "home", "overview"],
      },
      {
        label: "Library",
        href: "/app/knowledge-bases",
        icon: FolderOpen,
        description: "Research workspaces and sources",
        keywords: ["documents", "knowledge", "base", "upload", "sources", "library"],
      },
      {
        label: "Research",
        href: "/app/research",
        icon: Microscope,
        description: "Ask questions grounded in your sources",
        keywords: ["research", "chat", "ask", "questions", "citations"],
      },
      {
        label: "Studio",
        href: "/app/studio",
        icon: Sparkles,
        description: "Summaries, reports, quizzes and more",
        keywords: ["studio", "artifacts", "summary", "report", "quiz", "podcast"],
      },
      {
        label: "Study",
        href: "/app/study",
        icon: GraduationCap,
        description: "Quizzes, flashcards and learning progress",
        keywords: ["study", "quiz", "flashcards", "review", "progress", "learn"],
      },
    ],
  },
  {
    label: "Evaluate",
    defaultCollapsed: true,
    items: [
      {
        label: "Evaluation",
        href: "/app/evaluation",
        icon: BarChart3,
        description: "Benchmark retrieval performance",
        keywords: ["evaluation", "metrics", "benchmark", "recall", "ndcg"],
      },
      {
        label: "Retrieval Lab",
        href: "/app/retrieval-lab",
        icon: Search,
        description: "Test retrieval configurations",
        keywords: ["retrieval", "lab", "test", "search"],
      },
      {
        label: "Benchmark Explorer",
        href: "/app/benchmark-explorer",
        icon: FlaskConical,
        description: "Compare benchmark runs",
        keywords: ["benchmark", "explorer", "compare", "scatter"],
      },
      {
        label: "Leaderboards",
        href: "/app/leaderboards",
        icon: BarChart3,
        description: "Ranked benchmark results",
        keywords: ["leaderboards", "rankings"],
      },
      {
        label: "Golden Datasets",
        href: "/app/datasets",
        icon: FolderOpen,
        description: "Curated evaluation datasets",
        keywords: ["datasets", "golden", "evaluation"],
      },
      {
        label: "Regression Testing",
        href: "/app/regression",
        icon: FlaskConical,
        description: "Guard retrieval quality over time",
        keywords: ["regression", "testing", "guards"],
      },
      {
        label: "Model Comparison",
        href: "/app/model-comparison",
        icon: GitBranch,
        description: "Compare model outputs",
        keywords: ["model", "comparison", "providers"],
      },
      {
        label: "Research Analytics",
        href: "/app/research/analytics",
        icon: Lightbulb,
        description: "Statistical analysis of evaluation runs",
        keywords: ["research", "analytics", "statistics", "runs"],
      },
      {
        label: "Prompt Library",
        href: "/app/prompts",
        icon: FileText,
        description: "Curated prompt templates",
        keywords: ["prompt", "library", "templates"],
      },
      {
        label: "Advanced Retrieval",
        href: "/app/advanced-retrieval",
        icon: GitBranch,
        description: "Hybrid and BM25 retrieval controls",
        keywords: ["advanced", "retrieval", "hybrid", "bm25"],
      },
      {
        label: "Chunking Studio",
        href: "/app/chunking-studio",
        icon: Code2,
        description: "Split and inspect text chunks",
        keywords: ["chunking", "split", "text", "chunks"],
      },
      {
        label: "Experiment Builder",
        href: "/app/experiment-builder",
        icon: FlaskConical,
        description: "Build a retrieval experiment",
        keywords: ["experiment", "builder", "workflow", "pipeline"],
      },
      {
        label: "Experiment Planner",
        href: "/app/planner",
        icon: Lightbulb,
        description: "Plan and suggest experiments",
        keywords: ["planner", "plan", "experiment", "suggest"],
      },
      {
        label: "Experiment Lineage",
        href: "/app/lineage",
        icon: GitBranch,
        description: "Version and provenance history",
        keywords: ["lineage", "history", "versions", "provenance"],
      },
      {
        label: "Publication",
        href: "/app/publication",
        icon: FileText,
        description: "Export research into reports",
        keywords: ["publication", "export", "paper", "report", "pdf"],
      },
      {
        label: "Review Queue",
        href: "/app/reviews",
        icon: Eye,
        description: "Human review of model answers",
        keywords: ["review", "queue", "human", "answers"],
      },
      {
        label: "Quality Gates",
        href: "/app/quality-gates",
        icon: Bot,
        description: "Hard quality checkpoints",
        keywords: ["quality", "gates", "guardrails"],
      },
    ],
  },
  {
    label: "Observe",
    defaultCollapsed: true,
    items: [
      {
        label: "Observability",
        href: "/app/observability",
        icon: Activity,
        description: "Observability overview",
        keywords: ["observability", "dashboard", "ops"],
      },
      {
        label: "Trace Explorer",
        href: "/app/observability/traces",
        icon: Search,
        keywords: ["traces", "trace", "spans"],
      },
      {
        label: "Live Metrics",
        href: "/app/observability/live",
        icon: Radio,
        keywords: ["live", "metrics", "realtime"],
      },
      {
        label: "Session Replay",
        href: "/app/observability/sessions",
        icon: Eye,
        keywords: ["sessions", "replay"],
      },
      {
        label: "Cost Intelligence",
        href: "/app/observability/costs",
        icon: DollarSign,
        keywords: ["cost", "spend", "billing"],
      },
      {
        label: "Provider Health",
        href: "/app/observability/providers",
        icon: CircleDot,
        keywords: ["providers", "health", "uptime"],
      },
      {
        label: "Alerting",
        href: "/app/observability/alerts",
        icon: AlertTriangle,
        keywords: ["alerts", "alerting", "notifications"],
      },
      {
        label: "Drift Detection",
        href: "/app/observability/drift",
        icon: Layers,
        keywords: ["drift", "detection", "shifts"],
      },
      {
        label: "Pipeline Inspector",
        href: "/app/observability/pipeline",
        icon: GitBranch,
        keywords: ["pipeline", "inspector", "jobs"],
      },
      {
        label: "Incident Center",
        href: "/app/observability/incidents",
        icon: AlertTriangle,
        keywords: ["incidents", "incident", "center"],
      },
      {
        label: "Storage",
        href: "/app/observability/storage",
        icon: HardDrive,
        keywords: ["storage", "objects", "files"],
      },
    ],
  },
  {
    label: "Settings",
    defaultCollapsed: true,
    items: [
      {
        label: "Configuration",
        href: "/app/settings",
        icon: SlidersHorizontal,
        description: "Workspace configuration",
        keywords: ["settings", "config", "preferences"],
      },
      {
        label: "Architecture",
        href: "/app/architecture",
        icon: BookOpen,
        description: "System architecture reference",
        keywords: ["architecture", "design", "system"],
      },
      {
        label: "Project Guide",
        href: "/app/project-guide",
        icon: GraduationCap,
        description: "Guides and tutorials",
        keywords: ["guide", "tutorial", "learn", "getting started"],
      },
    ],
  },
];

export const FLAT_APP_NAV: AppNavItem[] = APP_NAV.flatMap((section) => section.items);

// The off-canvas sidebar and its header trigger live in different components
// either side of the server layout, so they coordinate through this window
// event rather than threading client state through the layout.
export const APP_SIDEBAR_OPEN_EVENT = "kairos:open-sidebar";
