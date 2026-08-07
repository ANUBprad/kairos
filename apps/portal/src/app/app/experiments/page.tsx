import { Suspense } from "react";
import { ExperimentsClient } from "./experiments-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Experiment Studio | Kairos",
  description: "AI-Powered RAG Experimentation & Evaluation Platform",
};

async function getExperiments() {
  return [];
}

async function getDatasets() {
  return [];
}

export default async function ExperimentsPage() {
  const [experiments, datasets] = await Promise.all([getExperiments(), getDatasets()]);

  return (
    <Suspense fallback={<Loading />}>
      <ExperimentsClient initialExperiments={experiments} initialDatasets={datasets} />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
