import Link from "next/link";
import Image from "next/image";
import { Layers, BookOpen, Settings } from "lucide-react";

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
  { label: "Knowledge Bases", href: "/app", icon: BookOpen },
  { label: "Settings", href: "/app/settings", icon: Settings },
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
              Organization
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

        {organization && organization.projects.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 py-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                Projects
              </p>
            </div>
            <div className="mt-1 space-y-0.5">
              {organization.projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-text-secondary"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Layers size={15} className="shrink-0 text-text-tertiary" />
                    <span className="truncate">{project.name}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-text-tertiary">
                    {project._count.knowledgeBases}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
