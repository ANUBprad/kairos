"use client";

import { useState } from "react";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth-client";

export default function LoginPage() {
  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const handleGithubSignIn = async () => {
    setIsGithubLoading(true);
    await authClient.signIn.social({ provider: "github", callbackURL: "/app" });
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
