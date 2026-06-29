"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, ForgotPasswordInput } from "@/lib/validation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { toast } from "sonner";
import { sendForgotPasswordEmail } from "@/lib/client/auth-client";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);

    try {
      await sendForgotPasswordEmail(data.email);
      setIsSent(true);
      toast.success("Reset link sent. Check your inbox.", { duration: 5000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.", { duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="space-y-6">
        <div className="text-center lg:text-left">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto lg:mx-0 mb-4">
            <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
            Check your inbox
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
            If an account exists with that email, we&apos;ve sent a password reset link.
            It expires in 1 hour.
          </p>
        </div>

        <Link
          href="/login"
          className="flex items-center justify-center lg:justify-start gap-1.5 text-[13px] text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
          Reset your password
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="Email"
          type="email"
          placeholder="you@example.com"
          register={register("email")}
          error={errors.email}
          autoComplete="email"
          disabled={isLoading}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full h-11 text-[14px]"
          disabled={!isValid || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Sending...
            </span>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center lg:justify-start gap-1.5 text-[13px] text-text-tertiary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        Back to sign in
      </Link>
    </div>
  );
}
