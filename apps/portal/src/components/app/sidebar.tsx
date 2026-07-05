import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  FolderOpen,
  Code2,
  FlaskConical,
  Bot,
  History,
  BarChart3,
  SlidersHorizontal,
  GitBranch,
  BookOpen,
  Microscope,
  GraduationCap,
} from "lucide-react";

interface SidebarProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    projects: {
      id: string;
      name: string;
      _count: { knowledgeBases: number };
    }[];
  } | null;
  userEmail: string;
}

const navItems = [
  { label: "Overview", href: "/app", icon: LayoutDashboard },
  { label: "Document Repository", href: "/app/knowledge-bases", icon: FolderOpen },
  { label: "Chunking Studio", href: "/app/chunking-studio", icon: Code2 },
  { label: "Retrieval Lab", href: "/app/retrieval-lab", icon: FlaskConical },
  { label: "Advanced Retrieval", href: "/app/advanced-retrieval", icon: GitBranch },
  { label: "RAG Chat", href: "/app/rag-chat", icon: Bot },
  { label: "Experiment History", href: "/app/experiments", icon: History },
  { label: "Evaluation", href: "/app/evaluation", icon: BarChart3 },
  { label: "Architecture", href: "/app/architecture", icon: BookOpen },
  { label: "Research Dashboard", href: "/app/research", icon: Microscope },
  { label: "Project Guide", href: "/app/project-guide", icon: GraduationCap },
  { label: "Configuration", href: "/app/settings", icon: SlidersHorizontal },
];

export function AppSidebar({ organization }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-3 border-b border-border px-5">
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Kairos home">
          <Image
            src="/kairos-nav.png"
            alt="Kairos"
            width={90}
            height={21}
            priority
            className="object-contain"
          />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {organization && (
          <div className="mb-4 rounded-lg border border-border bg-bg/50 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
              Project
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-text-primary">
              {organization.name}
            </p>
          </div>
        )}

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
