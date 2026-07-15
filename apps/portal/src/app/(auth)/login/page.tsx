"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Github, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth-client";
import { trackEvent } from "@/lib/telemetry/analytics";

const SAFE_REDIRECT_PATHS = ["/app", "/app/"];

function getSafeRedirect(raw: string | null): string {
  if (!raw) return "/app";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/app";
    return SAFE_REDIRECT_PATHS.some(
      (p) => url.pathname === p || url.pathname.startsWith("/app/"),
    )
      ? url.pathname + url.search
      : "/app";
  } catch {
    return "/app";
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = useMemo(
    () => getSafeRedirect(searchParams.get("redirect")),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsEmailLoading(true);
    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: redirect,
      });
      if (authError) {
        setError(authError.message || "Invalid email or password");
      } else {
        trackEvent("user_logged_in", { method: "email" });
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setIsGithubLoading(true);
    setError("");
    try {
      trackEvent("user_logged_in", { method: "github" });
      await authClient.signIn.social({
        provider: "github",
        callbackURL: redirect,
      });
    } catch {
      setError("GitHub sign-in failed");
      setIsGithubLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Sign in to your Kairos account
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailSignIn} className="space-y-4">
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
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-primary"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-brand hover:text-brand-hover transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            minLength={8}
            className="w-full h-11 rounded-lg border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          className="w-full h-11 gap-2.5 text-[13px]"
          disabled={isEmailLoading}
        >
          {isEmailLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Mail size={16} />
          )}
          Sign in with Email
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-bg px-2 text-text-tertiary">or</span>
        </div>
      </div>

      <Button
        variant="secondary"
        className="w-full h-11 gap-2.5 text-[13px]"
        onClick={handleGithubSignIn}
        disabled={isGithubLoading}
      >
        {isGithubLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Github className="h-4 w-4" />
        )}
        Continue with GitHub
      </Button>

      <p className="text-center text-[13px] text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-brand hover:text-brand-hover transition-colors"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="text-center lg:text-left">
            <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Sign in to your Kairos account
            </p>
          </div>
          <div className="space-y-4">
            <div className="h-11 rounded-lg bg-muted animate-pulse" />
            <div className="h-11 rounded-lg bg-muted animate-pulse" />
            <div className="h-11 rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
