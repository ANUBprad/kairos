import { SkeletonCard } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 rounded bg-surface" />
      <div className="h-4 w-72 rounded bg-surface" />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}