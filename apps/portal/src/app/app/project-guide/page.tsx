import { requireSession } from "@/lib/server/auth-utils";
import { ProjectGuide } from "./project-guide-client";

export const metadata = {
  title: "Project Guide | Kairos",
};

export default async function ProjectGuidePage() {
  await requireSession();

  return <ProjectGuide />;
}
