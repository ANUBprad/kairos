import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type WorkspacePageShellProps = {
  workspaceId: string;
  sectionLabel: string;
  children: ReactNode;
};

export function WorkspacePageShell({
  workspaceId,
  sectionLabel,
  children,
}: WorkspacePageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/85 px-3 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
        <Link
          href={`/workspace/${workspaceId}`}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg text-xs text-muted-foreground transition-colors hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Workspace Chat</span>
          </span>
        </Link>
        <span className="kairos-eyebrow max-w-[40%] shrink-0 truncate text-right">
          {sectionLabel}
        </span>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
