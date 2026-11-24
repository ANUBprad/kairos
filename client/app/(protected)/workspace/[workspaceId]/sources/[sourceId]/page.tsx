import { SourceDetail } from "@/features/sources";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface WorkspaceSourceDetailPageProps {
  params: Promise<{
    workspaceId: string;
    sourceId: string;
  }>;
}

export default async function WorkspaceSourceDetailPage({
  params,
}: WorkspaceSourceDetailPageProps) {
  const { workspaceId, sourceId } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link
          href={`/workspace/${workspaceId}/sources`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand transition-colors hover:text-primary motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to source library</span>
        </Link>
      </div>
      <SourceDetail workspaceId={workspaceId} sourceId={sourceId} />
    </div>
  );
}
