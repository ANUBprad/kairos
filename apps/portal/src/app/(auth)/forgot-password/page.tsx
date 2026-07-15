"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth-client";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/forgot-password`,
      });
      if (authError) {
        setError(authError.message || "Failed to send reset email");
      } else {
        setSent(true);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword,
        token: token!,
      });
      if (authError) {
        setError(authError.message || "Failed to reset password");
      } else {
        setResetSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 size={48} className="mx-auto text-success" />
        <div>
          <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
            Password reset complete
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Your password has been updated.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm font-semibold text-brand hover:text-brand-hover transition-colors"
        >
          Sign in with new password
        </Link>
      </div>
    );
  }

  if (token) {
    return (
      <div className="space-y-6">
        <div className="text-center lg:text-left">
          <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
            Set new password
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Enter your new password below.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-text-primary mb-1.5"
            >
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full h-11 rounded-lg border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            className="w-full h-11 text-[13px]"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Reset password
          </Button>
        </form>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 size={48} className="mx-auto text-success" />
        <div>
          <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
            Check your email
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            We sent a password reset link to <strong>{email}</strong>.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm font-semibold text-brand hover:text-brand-hover transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
          Forgot password?
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleRequestReset} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-text-primary mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full h-11 rounded-lg border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          className="w-full h-11 gap-2.5 text-[13px]"
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Mail size={16} />
          )}
          Send reset link
        </Button>
      </form>

      <p className="text-center text-[13px] text-text-secondary">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand hover:text-brand-hover transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-text-tertiary" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
