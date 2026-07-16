import dynamic from "next/dynamic";

const ChunkingStudio = dynamic(() => import("./studio-client").then((m) => m.ChunkingStudio), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "Chunking Studio | Kairos",
};

export default function ChunkingStudioPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-lg font-semibold text-text-primary">Chunking Studio</h1>
        <p className="mt-1 text-sm text-text-secondary">
          <strong className="text-text-primary">Purpose:</strong> Experiment with how documents are split into chunks.
        </p>
        <p className="mt-1 text-sm text-text-tertiary">
          <strong className="text-text-secondary">Why it matters:</strong> Chunk size and strategy determine what information is available for retrieval.
          Too small loses context. Too large introduces noise. The optimal range is 500-1000 tokens with 10-20% overlap.
        </p>
        <p className="mt-1 text-sm text-text-tertiary">
          <strong className="text-text-secondary">What you can learn:</strong> How each strategy handles different document types.
          Why recursive chunking works best for general-purpose use. How overlap prevents information loss at boundaries.
        </p>
      </div>
      <ChunkingStudio />
    </div>
  );
}
