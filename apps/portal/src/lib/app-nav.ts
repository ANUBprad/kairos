import {
  LayoutDashboard,
  Microscope,
  GitBranch,
  Lightbulb,
  FileText,
  FolderOpen,
  Code2,
  FlaskConical,
  Search,
  BarChart3,
  Bot,
  BookOpen,
  GraduationCap,
  SlidersHorizontal,
  NotebookPen,
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
}

export const APP_NAV: AppNavSection[] = [
  {
    label: "Research",
    items: [
      {
        label: "Overview",
        href: "/app",
        icon: LayoutDashboard,
        description: "Workspace home",
        keywords: ["dashboard", "home", "overview"],
      },
      {
        label: "Research Dashboard",
        href: "/app/research",
        icon: Microscope,
        description: "Aggregated research metrics and analysis",
        keywords: ["research", "dashboard", "metrics", "analysis"],
      },
      {
        label: "Notebook",
        href: "/app/notebook",
        icon: NotebookPen,
        
        description: "Research notes and journal",
        keywords: ["notebook", "notes", "journal", "markdown"],
      },
      {
        label: "Experiment Lineage",
        href: "/app/lineage",
        icon: GitBranch,
        description: "Version and provenance history",
        keywords: ["lineage", "history", "versions", "provenance"],
      },
      {
        label: "Experiment Planner",
        href: "/app/planner",
        icon: Lightbulb,
        description: "Plan and suggest experiments",
        keywords: ["planner", "plan", "experiment", "suggest"],
      },
      {
        label: "Publication",
        href: "/app/publication",
        icon: FileText,
        
        description: "Export research into reports",
        keywords: ["publication", "export", "paper", "report", "pdf"],
      },
    ],
  },
  {
    label: "Build",
    items: [
      {
        label: "Knowledge Bases",
        href: "/app/knowledge-bases",
        icon: FolderOpen,
        description: "Upload and organize source documents",
        keywords: ["documents", "knowledge", "base", "upload"],
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
        
        description: "Build a retrieval pipeline",
        keywords: ["experiment", "builder", "workflow", "pipeline"],
      },
    ],
  },
  {
    label: "Evaluate",
    items: [
      {
        label: "Retrieval Lab",
        href: "/app/retrieval-lab",
        icon: Search,
        description: "Test retrieval configurations",
        keywords: ["retrieval", "lab", "test", "search"],
      },
      {
        label: "Advanced Retrieval",
        href: "/app/advanced-retrieval",
        icon: GitBranch,
        description: "Hybrid and BM25 retrieval controls",
        keywords: ["advanced", "retrieval", "hybrid", "bm25"],
      },
      {
        label: "Evaluation",
        href: "/app/evaluation",
        icon: BarChart3,
        description: "Benchmark retrieval performance",
        keywords: ["evaluation", "metrics", "benchmark", "recall", "ndcg"],
      },
      {
        label: "Benchmark Explorer",
        href: "/app/benchmark-explorer",
        icon: FlaskConical,
        
        description: "Compare benchmark runs",
        keywords: ["benchmark", "explorer", "compare", "scatter"],
      },
    ],
  },
  {
    label: "PromptOps",
    items: [
      {
        label: "Prompt Library",
        href: "/app/prompts",
        icon: FileText,
        
        description: "Curated prompt templates",
        keywords: ["prompt", "library", "templates"],
      },
      {
        label: "Model Comparison",
        href: "/app/model-comparison",
        icon: GitBranch,
        
        description: "Compare model outputs",
        keywords: ["model", "comparison", "providers"],
      },
      {
        label: "Regression Testing",
        href: "/app/regression",
        icon: FlaskConical,
        
        description: "Guard retrieval quality over time",
        keywords: ["regression", "testing", "guards"],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        label: "Leaderboards",
        href: "/app/leaderboards",
        icon: BarChart3,
        
        description: "Ranked benchmark results",
        keywords: ["leaderboards", "rankings"],
      },
      {
        label: "Quality Gates",
        href: "/app/quality-gates",
        icon: Bot,
        
        description: "Hard quality checkpoints",
        keywords: ["quality", "gates", "guardrails"],
      },
      {
        label: "Analytics",
        href: "/app/analytics",
        icon: Lightbulb,
        
        description: "Usage and performance trends",
        keywords: ["analytics", "usage", "trends"],
      },
      {
        label: "Golden Datasets",
        href: "/app/datasets",
        icon: FolderOpen,
        
        description: "Curated evaluation datasets",
        keywords: ["datasets", "golden", "evaluation"],
      },
      {
        label: "Review Queue",
        href: "/app/reviews",
        icon: Eye,
        
        description: "Human review of model answers",
        keywords: ["review", "queue", "human", "answers"],
      },
    ],
  },
  {
    label: "Learn",
    items: [
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
  {
    label: "Observability",
    items: [
      {
        label: "Dashboard",
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
    label: "System",
    items: [
      {
        label: "Configuration",
        href: "/app/settings",
        icon: SlidersHorizontal,
        description: "Workspace configuration",
        keywords: ["settings", "config", "preferences"],
      },
    ],
  },
];

export const FLAT_APP_NAV: AppNavItem[] = APP_NAV.flatMap((section) => section.items);