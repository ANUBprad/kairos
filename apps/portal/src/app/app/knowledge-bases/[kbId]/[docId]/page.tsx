import { getDocumentDetails } from "@/lib/actions/document";
import { DocumentDetailsClient } from "./document-details-client";
import { notFound } from "next/navigation";

export default async function DocumentDetailsPage({
  params,
}: {
  params: Promise<{ kbId: string; docId: string }>;
}) {
  const { kbId, docId } = await params;

  try {
    const doc = await getDocumentDetails(docId);

    if (!doc || doc.knowledgeBaseId !== kbId) {
      notFound();
    }

    return <DocumentDetailsClient document={doc} kbId={kbId} />;
  } catch {
    notFound();
  }
}
