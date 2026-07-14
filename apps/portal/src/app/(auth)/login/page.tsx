"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth-client";

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

  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const handleGithubSignIn = async () => {
    setIsGithubLoading(true);
    await authClient.signIn.social({
      provider: "github",
      callbackURL: redirect,
    });
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
          <div className="w-full h-11 rounded-md bg-muted animate-pulse" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
