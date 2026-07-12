import { requireSession } from "@/lib/server/auth-utils";
import dynamic from "next/dynamic";

const ExperimentBuilderClient = dynamic(
  () => import("./experiment-builder-client").then((mod) => mod.ExperimentBuilderClient),
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
  title: "Experiment Builder",
  description: "Visually assemble RAG experiment pipelines with drag-and-drop stages.",
};

export default async function ExperimentBuilderPage() {
  await requireSession();
  return <ExperimentBuilderClient />;
}
