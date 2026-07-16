import dynamic from "next/dynamic";

const NotebookPageClient = dynamic(
  () => import("./notebook-client").then((mod) => mod.NotebookPageClient),
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
  title: "Research Notebook",
  description: "Create and organize research notes with charts, tables, and experiment references.",
};

export default async function NotebookPage() {
  return <NotebookPageClient />;
}
