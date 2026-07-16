import dynamic from "next/dynamic";
import { listKbsForLab } from "@/lib/actions/retrieval-lab";
import { PageHeader } from "@/components/app/page-header";

const RetrievalLab = dynamic(() => import("@/components/app/retrieval-lab").then((m) => m.RetrievalLab), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "Retrieval Lab",
};

export default async function RetrievalLabPage() {
  const kbs = await listKbsForLab();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Retrieval Lab"
        description="Test retrieval configurations interactively with real-time parameter adjustment."
        purpose="Test retrieval configurations interactively."
        relatedPages={[
          { label: "Evaluation", href: "/app/evaluation" },
          { label: "Advanced Retrieval", href: "/app/advanced-retrieval" },
        ]}
      />
      <RetrievalLab kbs={kbs} />
    </div>
  );
}
