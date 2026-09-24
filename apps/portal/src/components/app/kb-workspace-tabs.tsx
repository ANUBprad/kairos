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

export function KbWorkspaceTabs({ kbId, active, customHighlight }: KbWorkspaceTabsProps) {
  return (
    <nav
      className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
      aria-label="Knowledge base workspace"
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