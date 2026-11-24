"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { useAuth } from "../hooks/use-auth";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { GithubIcon } from "@/components/ui/github-icon";

interface AuthFormProps {
  initialMode?: "login" | "signup";
}

const fieldClass =
  "w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";

export function AuthForm({ initialMode = "login" }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const {
    loginMutation,
    signupMutation,
    signInWithGoogle,
    signInWithGithub,
    authError,
    setAuthError,
  } = useAuth();

  const isLoading = loginMutation.isPending || signupMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email || !password) {
      setAuthError("Please fill in all required fields.");
      return;
    }

    if (mode === "signup" && !name) {
      setAuthError("Please enter your name.");
      return;
    }

    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      signupMutation.mutate({ name, email, password });
    }
  };

  const toggleMode = () => {
    setAuthError(null);
    const nextMode = mode === "login" ? "signup" : "login";
    setMode(nextMode);
    router.replace(nextMode === "login" ? "/login" : "/signup");
  };

  return (
    <div className="flex w-full max-w-105 flex-col justify-center px-6 py-10 sm:px-10">
      <div className="flex flex-col items-center text-center">
        <KairosLogo size={34} textSize="text-2xl" className="mb-8" />

        <h1 className="kairos-display text-[28px] sm:text-[32px]">
          {mode === "login" ? "Welcome back." : "Start with the sources."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to continue your research."
            : "Create a workspace and bring your material together."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {authError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-center text-xs font-medium text-danger"
          >
            {authError}
          </div>
        ) : null}

        {mode === "signup" ? (
          <div className="space-y-1.5 text-left">
            <label htmlFor="name" className="text-xs font-semibold text-foreground">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              disabled={isLoading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className={fieldClass}
            />
          </div>
        ) : null}

        <div className="space-y-1.5 text-left">
          <label htmlFor="email" className="text-xs font-semibold text-foreground">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            disabled={isLoading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5 text-left">
          <label htmlFor="password" className="text-xs font-semibold text-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={`${fieldClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <ThemeLoader size={18} />
          ) : (
            <>
              <span>{mode === "login" ? "Log in" : "Create account"}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          {mode === "login" ? "New to Kairos?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={toggleMode}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>

        <div className="relative flex items-center justify-center py-2">
          <div className="w-full border-t border-border" />
          <span className="absolute bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            or continue with
          </span>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => void signInWithGithub()}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GithubIcon size={16} />
            Continue with GitHub
          </button>
        </div>
      </form>

      <p className="mt-7 text-center text-[11px] text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link
          href="/terms"
          className="font-semibold text-foreground transition-colors hover:text-primary"
        >
          terms &amp; conditions
        </Link>
      </p>
    </div>
  );
}
