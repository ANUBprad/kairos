import { listKbsForLab } from "@/lib/actions/retrieval-lab";
import { RetrievalLab } from "@/components/app/retrieval-lab";

export const metadata = {
  title: "Retrieval Lab | Kairos",
};

export default async function RetrievalLabPage() {
  const kbs = await listKbsForLab();

  return <RetrievalLab kbs={kbs} />;
}
