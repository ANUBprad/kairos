import Link from "next/link";

// Single source of truth for the Knowledge Base workspace navigation, used by
// every KB surface (sources, research/chat, studio, study, artifact detail)
// instead of five hand-rolled copies of the same tab bar.
export type KbWorkspaceTabValue = "sources" | "research" | "studio" | "study";

const KB_WORKSPACE_TABS: { value: KbWorkspaceTabValue; label: string }[] = [
  { value: "sources", label: "Sources" },
  { value: "research", label: "Research" },
  { value: "studio", label: "Studio" },
  { value: "study", label: "Study" },
];

export function kbWorkspaceHref(kbId: string, value: KbWorkspaceTabValue): string {
  switch (value) {
    case "sources":
      return `/app/knowledge-bases/${kbId}`;
    case "research":
      return `/app/knowledge-bases/${kbId}/chat`;
    case "studio":
      return `/app/knowledge-bases/${kbId}/studio`;
    case "study":
      return `/app/knowledge-bases/${kbId}/study`;
  }
}

interface KbWorkspaceTabsProps {
  kbId: string;
  active?: KbWorkspaceTabValue;
  /** Label for an active sub-view (e.g. "Artifact") that is not one of the four tabs. */
  customHighlight?: string;
}

// The workspace title + tab bar are the same on every KB surface, so the four
// surfaces share one header instead of re-deriving the eyebrow, title and tabs
// each time. The artifact detail page keeps its own header because its title is
// the artifact name, not a tab.
interface WorkspaceHeaderProps {
  kbId: string;
  kbName: string;
  title: string;
  description?: string;
  active?: KbWorkspaceTabValue;
  customHighlight?: string;
  action?: React.ReactNode;
  className?: string;
}

export function WorkspaceHeader({
  kbId,
  kbName,
  title,
  description,
  active,
  customHighlight,
  action,
  className = "mb-6",
}: WorkspaceHeaderProps) {
  return (
    <header className={className}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-brand">{kbName}</p>
          <h1 className="page-title mt-0.5">{title}</h1>
          {description ? <p className="page-description mt-1">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <KbWorkspaceTabs kbId={kbId} active={active} customHighlight={customHighlight} />
    </header>
  );
}

export function KbWorkspaceTabs({ kbId, active, customHighlight }: KbWorkspaceTabsProps) {
  return (
    <nav
      className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
      aria-label="Workspace"
    >
      {KB_WORKSPACE_TABS.map((tab) =>
        tab.value === active ? (
          <span
            key={tab.value}
            className="rounded-md bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.value}
            href={kbWorkspaceHref(kbId, tab.value)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            {tab.label}
          </Link>
        ),
      )}
      {customHighlight ? (
        <span className="rounded-md bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
          {customHighlight}
        </span>
      ) : null}
    </nav>
  );
}