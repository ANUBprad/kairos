import { requireSession } from "@/lib/server/auth-utils";
import dynamic from "next/dynamic";

const BenchmarkExplorerClient = dynamic(
  () => import("./benchmark-explorer-client").then((mod) => mod.BenchmarkExplorerClient),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-surface" />
        <div className="h-4 w-96 animate-pulse rounded bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    ),
  }
);

export const metadata = {
  title: "Benchmark Explorer",
  description: "Interactive exploration of benchmark results with scatter plots, parallel coordinates, and statistical analysis.",
};

export default async function BenchmarkExplorerPage() {
  await requireSession();
  return <BenchmarkExplorerClient />;
}
