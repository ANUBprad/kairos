"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Research",
    items: [
      { label: "Overview", href: "/app", icon: LayoutDashboard },
      { label: "Research Dashboard", href: "/app/research", icon: Microscope },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { label: "Document Repository", href: "/app/knowledge-bases", icon: FolderOpen },
      { label: "Chunking Studio", href: "/app/chunking-studio", icon: Code2 },
    ],
  },
  {
    label: "Retrieval",
    items: [
      { label: "Retrieval Lab", href: "/app/retrieval-lab", icon: FlaskConical },
      { label: "Advanced Retrieval", href: "/app/advanced-retrieval", icon: GitBranch },
      { label: "RAG Chat", href: "/app/rag-chat", icon: Bot },
    ],
  },
  {
    label: "Analysis",
    items: [
      { label: "Evaluation", href: "/app/evaluation", icon: BarChart3 },
      { label: "Experiment History", href: "/app/experiments", icon: History },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "Architecture", href: "/app/architecture", icon: BookOpen },
      { label: "Project Guide", href: "/app/project-guide", icon: GraduationCap },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Configuration", href: "/app/settings", icon: SlidersHorizontal },
    ],
  },
];

export function AppSidebar({ organization }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-3 border-b border-border px-5">
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Kairos home">
          <Image
            src="/kai.png"
            alt="Kairos"
            width={28}
            height={28}
            priority
            className="object-contain"
          />
          <span className="text-sm font-semibold text-text-primary">Kairos</span>
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

        <nav className="space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary/60">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/app"
                      ? pathname === "/app"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-brand/10 text-brand"
                          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      )}
                    >
                      <Icon size={18} className={isActive ? "text-brand" : ""} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
