"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteKnowledgeBase } from "@/lib/actions/knowledge-base";

interface Props {
  kb: { id: string; name: string } | null;
  onClose: () => void;
}

export function DeleteKnowledgeBaseDialog({ kb, onClose }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (!kb) return null;

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.set("id", kb.id);

      await deleteKnowledgeBase(formData);
      toast.success("Knowledge base deleted");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete knowledge base");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && onClose()} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Delete</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-error/20 bg-error/5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error/10">
            <AlertTriangle size={18} className="text-error" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              Delete &ldquo;{kb.name}&rdquo;?
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              This action cannot be undone. All documents in this knowledge base will be permanently deleted.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-6">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1 bg-error hover:bg-red-700 active:bg-red-800"
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
