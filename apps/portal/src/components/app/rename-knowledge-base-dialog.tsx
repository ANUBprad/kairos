"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { toast } from "sonner";
import { renameKnowledgeBase } from "@/lib/actions/knowledge-base";

const renameSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
});

interface Props {
  kb: { id: string; name: string } | null;
  onClose: () => void;
}

export function RenameKnowledgeBaseDialog({ kb, onClose }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<{ name: string }>({
    resolver: zodResolver(renameSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    if (kb) setValue("name", kb.name);
  }, [kb, setValue]);

  if (!kb) return null;

  const onSubmit = async (data: { name: string }) => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.set("id", kb.id);
      formData.set("name", data.name);

      await renameKnowledgeBase(formData);
      toast.success("Knowledge base renamed");
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename knowledge base");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && onClose()} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Rename</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

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
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
