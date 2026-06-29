"use client";

import { useState } from "react";
import { BookOpen, Plus, MoreHorizontal, Pencil, Trash2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
          <BookOpen size={32} className="text-brand" />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-text-primary">
          No knowledge bases yet
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm text-text-secondary">
          Create your first knowledge base to start uploading documents and building retrieval systems.
        </p>
        <Button variant="primary" className="mt-8" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Create knowledge base
        </Button>
        <CreateKnowledgeBaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Knowledge Bases</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {items.length} {items.length === 1 ? "knowledge base" : "knowledge bases"}
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((kb) => (
          <Card key={kb.id} className="group relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
                  <BookOpen size={20} className="text-brand" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">{kb.name}</h3>
                  {kb.description && (
                    <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">
                      {kb.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === kb.id ? null : kb.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary opacity-0 transition-opacity hover:bg-surface-hover hover:text-text-secondary group-hover:opacity-100"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen === kb.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-xl">
                      <button
                        onClick={() => { setRenameTarget(kb); setMenuOpen(null); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        <Pencil size={15} />
                        Rename
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(kb); setMenuOpen(null); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-error"
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Badge variant="default">
                <FileText size={12} className="mr-1" />
                {kb._count.documents} {kb._count.documents === 1 ? "document" : "documents"}
              </Badge>
              <span className="text-[11px] text-text-tertiary">
                Created {new Date(kb.createdAt).toLocaleDateString()}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <CreateKnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <RenameKnowledgeBaseDialog
        kb={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteKnowledgeBaseDialog
        kb={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
