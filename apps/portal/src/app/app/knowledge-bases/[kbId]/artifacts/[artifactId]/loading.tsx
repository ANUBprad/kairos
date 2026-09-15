import { Loader2 } from "lucide-react";

export default function ArtifactDetailLoading() {
  return (
    <div className="flex h-full items-center justify-center py-24">
      <Loader2 size={24} className="animate-spin text-text-tertiary" />
    </div>
  );
}
