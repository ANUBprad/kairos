import { listKbsForLab } from "@/lib/actions/retrieval-lab";
import { RetrievalLab } from "@/components/app/retrieval-lab";

export const metadata = {
  title: "Retrieval Lab | Kairos",
};

export default async function RetrievalLabPage() {
  const kbs = await listKbsForLab();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-lg font-semibold text-text-primary">Retrieval Lab</h1>
        <p className="mt-1 text-sm text-text-secondary">
          <strong className="text-text-primary">Purpose:</strong> Test retrieval configurations interactively with real-time parameter adjustment.
        </p>
        <p className="mt-1 text-sm text-text-tertiary">
          <strong className="text-text-secondary">Why it matters:</strong> No single retrieval strategy works best for all queries.
          The research shows hybrid approaches (vector + BM25 with RRF) consistently outperform individual strategies.
        </p>
        <p className="mt-1 text-sm text-text-tertiary">
          <strong className="text-text-secondary">What you can learn:</strong> When to use each strategy. How similarity thresholds affect results.
          Why reranking improves precision by 10-15%. How query expansion improves recall by 5-10%.
        </p>
      </div>
      <RetrievalLab kbs={kbs} />
    </div>
  );
}
