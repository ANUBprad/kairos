import { requireSession } from "@/lib/server/auth-utils";
import dynamic from "next/dynamic";

const ArchitectureViewer = dynamic(
  () => import("./architecture-client").then((mod) => mod.ArchitectureViewer),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-surface" />
        <div className="h-4 w-96 animate-pulse rounded bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    ),
  }
);

export const metadata = {
  title: "Architecture",
};

export default async function ArchitecturePage() {
  await requireSession();

  return <ArchitectureViewer />;
}
