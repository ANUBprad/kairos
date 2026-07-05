"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { toast } from "sonner";
import { createKnowledgeBase } from "@/lib/actions/knowledge-base";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
});

type CreateInput = z.infer<typeof createSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateKnowledgeBaseDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<CreateInput>({
    resolver: zodResolver(createSchema),
    mode: "onBlur",
  });

  if (!open) return null;

  const onSubmit = async (data: CreateInput) => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.set("name", data.name);
      if (data.description) formData.set("description", data.description);

      await createKnowledgeBase(formData);
      toast.success("Knowledge base created");
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create knowledge base");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Create knowledge base</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            disabled={isLoading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Name"
            placeholder="e.g., Product Documentation"
            register={register("name")}
            error={errors.name}
            value={watch("name") || ""}
            disabled={isLoading}
          />
          <FormField
            label="Description (optional)"
            placeholder="What is this knowledge base for?"
            register={register("description")}
            error={errors.description}
            value={watch("description") || ""}
            maxChars={1000}
            disabled={isLoading}
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
