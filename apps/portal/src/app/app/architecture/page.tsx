import { getServerSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { ArchitectureViewer } from "./architecture-client";

export const metadata = {
  title: "Architecture | Kairos",
};

export default async function ArchitecturePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return <ArchitectureViewer />;
}
