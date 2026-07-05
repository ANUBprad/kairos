"use client";

import { useState } from "react";
import Link from "next/link";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth-client";

export default function SignupPage() {
  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const handleGithubSignIn = async () => {
    setIsGithubLoading(true);
    await authClient.signIn.social({ provider: "github", callbackURL: "/app" });
  };

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Start building with Kairos for free.
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

      <p className="text-center text-[13px] text-text-secondary">
        Already have an account?{" "}
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
