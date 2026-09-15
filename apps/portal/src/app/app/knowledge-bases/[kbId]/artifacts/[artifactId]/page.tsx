import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/lib/server/auth-utils";
import { getArtifactDetailForUser, resolveArtifactReturnTarget } from "@/lib/artifacts/detail";
import { ArtifactDetailClient } from "@/components/app/studio/artifact-detail-client";

export const metadata: Metadata = { title: "Artifact | Knowledge Base" };

interface Props {
  params: Promise<{ kbId: string; artifactId: string }>;
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export default async function ArtifactDetailPage({ params, searchParams }: Props) {
  const { kbId, artifactId } = await params;
  const sp = await searchParams;
  const conversationId =
    typeof sp.conversation === "string" ? sp.conversation : undefined;

  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const detail = await getArtifactDetailForUser(kbId, artifactId, session.user.id);
  if (!detail) notFound();

  const returnConversationId = await resolveArtifactReturnTarget(
    kbId,
    conversationId,
    session.user.id,
  );

  return (
    <ArtifactDetailClient
      kbId={kbId}
      kbName={detail.kbName}
      artifact={detail.artifact}
      sources={detail.sources}
      returnConversationId={returnConversationId}
    />
  );
}
