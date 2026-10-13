"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateKnowledgeBaseDialog } from "@/components/app/create-knowledge-base-dialog";
import { RenameKnowledgeBaseDialog } from "@/components/app/rename-knowledge-base-dialog";
import { DeleteKnowledgeBaseDialog } from "@/components/app/delete-knowledge-base-dialog";

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: { documents: number };
}

interface Props {
  items: KnowledgeBaseItem[];
}

export function KnowledgeBaseList({ items }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<KnowledgeBaseItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBaseItem | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="page-title">Library</h1>
          <p className="page-description mt-1">Workspaces hold your sources. Create one to begin.</p>
        </header>

        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-8">
          <h2 className="section-title">Set up your first workspace</h2>
          <p className="mt-2 max-w-xl text-sm text-text-secondary">
            A workspace keeps one set of sources together. Upload files or add links, then research,
            create artifacts, and study from them.
          </p>
          <ol className="mt-6 space-y-5">
            {[
              {
                title: "Create a workspace",
                description: "Name it after the subject you're researching.",
              },
              {
                title: "Add your sources",
                description: "Upload PDFs, DOCX, TXT, MD or CSV files, or add a URL or video.",
              },
              {
                title: "Research, create, and study",
                description: "Ask grounded questions and turn your sources into artifacts.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-xs font-semibold text-text-secondary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{step.title}</p>
                  <p className="mt-0.5 text-sm text-text-tertiary">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="primary" className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Create workspace
          </Button>
        </section>

        <CreateKnowledgeBaseDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-description mt-1">
            {items.length} {items.length === 1 ? "workspace" : "workspaces"}
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New
        </Button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        <ul className="divide-y divide-border">
          {items.map((kb) => (
            <li key={kb.id} className="group flex items-center">
              <Link
                href={`/app/knowledge-bases/${kb.id}`}
                prefetch={false}
                className="flex min-w-0 flex-1 items-center gap-4 py-4 pl-5 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-hover text-text-tertiary">
                  <BookOpen size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary transition-colors group-hover:text-brand">
                    {kb.name}
                  </span>
                  {kb.description && (
                    <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                      {kb.description}
                    </span>
                  )}
                </span>
                <span className="hidden shrink-0 items-center gap-3 text-xs text-text-tertiary sm:flex">
                  <span>
                    {kb._count.documents} {kb._count.documents === 1 ? "document" : "documents"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(kb.createdAt).toLocaleDateString()}</span>
                </span>
                <ArrowRight
                  size={14}
                  className="hidden shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 sm:block"
                />
              </Link>

              <div className="relative shrink-0 pr-3">
                <button
                  onClick={() => setMenuOpen(menuOpen === kb.id ? null : kb.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Actions for ${kb.name}`}
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen === kb.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-xl">
                      <button
                        onClick={() => {
                          setRenameTarget(kb);
                          setMenuOpen(null);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        <Pencil size={15} />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(kb);
                          setMenuOpen(null);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-error"
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <CreateKnowledgeBaseDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RenameKnowledgeBaseDialog kb={renameTarget} onClose={() => setRenameTarget(null)} />
      <DeleteKnowledgeBaseDialog kb={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
