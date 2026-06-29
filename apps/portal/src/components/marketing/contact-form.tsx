"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, ContactInput } from "@/lib/validation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { FormField } from "@/components/FormField";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const subjects = [
  { value: "bug" as const, label: "Bug Report" },
  { value: "sales" as const, label: "Sales Inquiry" },
  { value: "support" as const, label: "Support Request" },
];

export function ContactForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: ContactInput) => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error, { duration: 5000 });
        return;
      }

      setIsSent(true);
      toast.success("Message sent! We'll respond within 24 hours.", { duration: 5000 });
      reset();
    } catch {
      toast.error("Something went wrong. Please try again.", { duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollReveal>
      <div className="rounded-[14px] border border-border bg-surface/50 p-8 max-w-lg mx-auto">
        <h2 className="text-sm font-semibold text-text-primary mb-5">
          {isSent ? "Message sent" : "Send us a message"}
        </h2>

        {isSent ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-text-secondary">
              Thanks for reaching out. We&apos;ll get back to you within 24 hours.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSent(false)}
            >
              Send another message
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              label="Name"
              placeholder="Your name"
              register={register("name")}
              error={errors.name}
              autoComplete="name"
              disabled={isLoading}
              maxChars={100}
              value={watch("name") || ""}
            />

            <FormField
              label="Email"
              type="email"
              placeholder="you@example.com"
              register={register("email")}
              error={errors.email}
              autoComplete="email"
              disabled={isLoading}
            />

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-text-primary">
                Subject
              </label>
              <select
                {...register("subject")}
                disabled={isLoading}
                className="w-full h-11 rounded-[10px] border border-border bg-surface/50 px-3.5 text-sm text-text-primary transition-all outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Select a subject</option>
                {subjects.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.subject && (
                <p className="text-xs text-error">{errors.subject.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-text-primary">
                Message
              </label>
              <textarea
                {...register("message")}
                rows={4}
                placeholder="How can we help?"
                disabled={isLoading}
                maxLength={5000}
                className="w-full rounded-[10px] border border-border bg-surface/50 px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/60 transition-all outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 resize-none disabled:opacity-40 disabled:cursor-not-allowed"
              />
              {errors.message && (
                <p className="text-xs text-error">{errors.message.message}</p>
              )}
              <p className="text-xs text-text-secondary text-right">
                {(watch("message") || "").length} / 5,000
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </span>
              ) : (
                "Send message"
              )}
            </Button>
          </form>
        )}
      </div>
    </ScrollReveal>
  );
}
