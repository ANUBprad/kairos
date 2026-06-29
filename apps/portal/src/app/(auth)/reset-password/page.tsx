"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, ResetPasswordInput } from "@/lib/validation";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { toast } from "sonner";
import { resetPassword } from "@/lib/client/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    defaultValues: { token, password: "", passwordConfirm: "" },
  });

  const password = watch("password");

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      toast.error("Invalid reset link. Request a new one.", { duration: 5000 });
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(data.password, token);
      toast.success("Password updated! Redirecting to login...", { duration: 3000 });
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.", { duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="text-center lg:text-left">
          <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
            Invalid reset link
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            This password reset link is invalid or expired. Request a new one.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="flex items-center justify-center lg:justify-start gap-1.5 text-[13px] text-brand hover:text-brand-hover transition-colors"
        >
          <ArrowLeft size={14} />
          Request new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
          Set new password
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Must be at least 8 characters with 1 uppercase letter and 1 number.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="New password"
          type="password"
          placeholder="Enter new password"
          register={register("password")}
          error={errors.password}
          autoComplete="new-password"
          disabled={isLoading}
          value={password || ""}
          showPasswordRequirements
        />

        <FormField
          label="Confirm new password"
          type="password"
          placeholder="Re-enter new password"
          register={register("passwordConfirm")}
          error={errors.passwordConfirm}
          autoComplete="new-password"
          disabled={isLoading}
          value={watch("passwordConfirm") || ""}
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
              Resetting password...
            </span>
          ) : (
            "Reset password"
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="text-center lg:text-left">
            <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
              Set new password
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
