import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth-utils";
import { getStudyDashboardForUser } from "@/lib/study/dashboard";
import { StudyDashboard } from "@/components/app/study/study-dashboard";

export const metadata = { title: "Study | Knowledge Base" };

export default async function StudyDashboardPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;

  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getStudyDashboardForUser(session.user.id, kbId);
  // Missing kb, wrong org, or no membership: same landing spot as the sibling
  // chat/studio pages rather than leaking exclusivity from the try/catch.
  if (!data) redirect("/app");

  return <StudyDashboard kbId={kbId} kbName={data.kbName} data={data} />;
}