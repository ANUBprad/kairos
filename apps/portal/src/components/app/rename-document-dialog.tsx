"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { toast } from "sonner";
import { renameDocument } from "@/lib/actions/document";

const renameSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
});

type RenameInput = z.infer<typeof renameSchema>;

interface Props {
  document: { id: string; name: string; knowledgeBaseId: string } | null;
  onClose: () => void;
}

export function RenameDocumentDialog({ document: doc, onClose }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RenameInput>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: doc?.name || "" },
    mode: "onBlur",
  });

  useEffect(() => {
    if (doc) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => dialogRef.current?.focus(), 100);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [doc]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    if (doc) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [doc, isLoading, onClose]);

  if (!doc) return null;

  const onSubmit = async (data: RenameInput) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.set("id", doc.id);
      formData.set("name", data.name);
      await renameDocument(formData);
      toast.success("Document renamed");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && onClose()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-doc-title"
        aria-describedby="rename-doc-description"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="rename-doc-title" className="text-lg font-semibold text-text-primary">Rename document</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary transition-colors hover:text-text-primary"
            disabled={isLoading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p id="rename-doc-description" className="sr-only">Enter a new name for this document.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Name"
            placeholder="Enter new name"
            register={register("name")}
            error={errors.name}
            value={watch("name") || ""}
            disabled={isLoading}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Renaming...
                </span>
              ) : (
                "Rename"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
