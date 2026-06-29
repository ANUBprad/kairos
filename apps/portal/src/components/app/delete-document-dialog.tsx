"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteDocument } from "@/lib/actions/document";

interface Props {
  document: { id: string; name: string; knowledgeBaseId: string } | null;
  onClose: () => void;
}

export function DeleteDocumentDialog({ document, onClose }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (!document) return null;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.set("id", document.id);
      await deleteDocument(formData);
      toast.success("Document deleted");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && onClose()} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Delete document</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary transition-colors hover:text-text-primary"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10">
            <Trash2 size={28} className="text-error" />
          </div>
          <p className="mt-4 text-text-primary">
            Are you sure you want to delete <strong>{document.name}</strong>?
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            This action cannot be undone. All chunks and processing data will be permanently removed.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 !border-error/30 !text-error hover:!bg-error/10"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
