import { getServerSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { ProjectGuide } from "./project-guide-client";

export const metadata = {
  title: "Project Guide | Kairos",
};

export default async function ProjectGuidePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return <ProjectGuide />;
}
