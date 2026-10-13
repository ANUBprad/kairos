import { Loader2 } from "lucide-react";

export default function ArtifactDetailLoading() {
  return (
    <div>
      <div className="animate-pulse mb-6 space-y-3">
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="flex items-start justify-between gap-3">
          <div className="h-7 w-64 rounded bg-surface" />
          <div className="h-5 w-20 rounded-full bg-surface" />
        </div>
        <div className="h-3 w-1/2 rounded bg-surface" />
        <div className="h-7 w-72 rounded-lg bg-surface" />
      </div>

      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    </div>
  );
}