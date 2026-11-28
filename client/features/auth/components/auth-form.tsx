"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { GithubIcon } from "@/components/ui/github-icon";
import { useAuth } from "../hooks/use-auth";

interface AuthFormProps {
  initialMode?: "login" | "signup";
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-foreground-secondary";
const errorClass = "mt-1.5 text-xs font-medium text-danger";
const socialClass =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ initialMode = "login" }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

    setAuthError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextErrors: FieldErrors = {};

    if (mode === "signup" && !trimmedName) {
      nextErrors.name = "Please enter your name.";
    }
    if (!trimmedEmail) {
      nextErrors.email = "Please enter your email address.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Please enter your password.";
    } else if (mode === "signup" && password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (mode === "login") {
      loginMutation.mutate({ email: trimmedEmail, password, rememberMe: remember });
    } else {
      signupMutation.mutate({ name: trimmedName, email: trimmedEmail, password });
    }
  };

  const toggleMode = () => {
    setAuthError(null);
    setFieldErrors({});
    setShowPassword(false);
    const nextMode = mode === "login" ? "signup" : "login";
    setMode(nextMode);
    router.replace(nextMode === "login" ? "/login" : "/signup");
  };

  return (
    <div className="w-full max-w-[420px]">
      <div className="auth-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">
          {mode === "login" ? "Welcome back" : "Get started"}
        </p>
        <h2 className="kairos-display mt-3 text-[32px] leading-tight text-foreground sm:text-[36px]">
          {mode === "login" ? "Sign in to Kairos." : "Create your workspace."}
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-foreground-secondary">
          {mode === "login"
            ? "Your sources, conversations and ideas are waiting."
            : "Bring your material together and start asking better questions."}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {authError ? (
          <div
            id="auth-error"
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm font-medium text-danger"
          >
            {authError}
          </div>
        ) : null}

        {mode === "signup" ? (
          <div>
            <label htmlFor="name" className={labelClass}>
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              disabled={isLoading}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="Jane Doe"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              className={fieldClass}
            />
            {fieldErrors.name ? (
              <p id="name-error" className={errorClass}>
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className={labelClass}>
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={isLoading}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={fieldClass}
          />
          {fieldErrors.email ? (
            <p id="email-error" className={errorClass}>
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={isLoading}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className={`${fieldClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-foreground-muted transition-colors hover:text-primary"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {fieldErrors.password ? (
            <p id="password-error" className={errorClass}>
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        {mode === "login" ? (
          <label htmlFor="remember" className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-foreground-secondary">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={isLoading}
              className="size-4 rounded border-input accent-primary"
            />
            Keep me signed in
          </label>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <ThemeLoader size={18} />
          ) : (
            <>
              <span>{mode === "login" ? "Sign in" : "Create account"}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        <p className="text-center text-[13px] text-foreground-secondary">
          {mode === "login" ? "New to Kairos?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={toggleMode}
            disabled={isLoading}
            className="font-semibold text-primary underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <div className="relative flex items-center justify-center py-1">
          <div className="w-full border-t border-border" />
          <span className="absolute bg-background px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            or continue with
          </span>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={isLoading}
            className={socialClass}
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
            className={socialClass}
          >
            <GithubIcon size={16} />
            Continue with GitHub
          </button>
        </div>

        <p className="pt-2 text-center text-[11px] text-foreground-muted">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="font-semibold text-foreground-secondary hover:text-primary">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="font-semibold text-foreground-secondary hover:text-primary">
            Privacy
          </Link>
          {" · "}
          <Link href="/support" className="font-semibold text-foreground-secondary hover:text-primary">
            Support
          </Link>
        </p>
      </form>
    </div>
  );
}
