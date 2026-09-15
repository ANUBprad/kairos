import { getDocumentDetails } from "@/lib/actions/document";
import { DocumentDetailsClient } from "./document-details-client";
import { notFound } from "next/navigation";

export default async function DocumentDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ kbId: string; docId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kbId, docId } = await params;
  const sp = await searchParams;
  const chunkIndex = typeof sp.chunk === "string" ? Number(sp.chunk) : undefined;

  try {
    const doc = await getDocumentDetails(docId);

    if (!doc || doc.knowledgeBaseId !== kbId) {
      notFound();
    }

    return <DocumentDetailsClient document={doc} kbId={kbId} initialChunkIndex={chunkIndex} />;
  } catch {
    notFound();
  }
}
