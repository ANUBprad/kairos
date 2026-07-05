import { requireSession } from "@/lib/server/auth-utils";
import { ArchitectureViewer } from "./architecture-client";

export const metadata = {
  title: "Architecture | Kairos",
};

export default async function ArchitecturePage() {
  await requireSession();

  return <ArchitectureViewer />;
}
