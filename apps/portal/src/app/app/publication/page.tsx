import { requireSession } from "@/lib/server/auth-utils";
import dynamic from "next/dynamic";

const PublicationModeClient = dynamic(
  () => import("./publication-client").then((mod) => mod.PublicationModeClient),
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
  title: "Publication Mode",
  description: "Generate publication-ready research outputs in Markdown, HTML, PDF, and LaTeX formats.",
};

export default async function PublicationPage() {
  await requireSession();
  return <PublicationModeClient />;
}
