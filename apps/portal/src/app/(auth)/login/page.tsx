"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/validation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { toast } from "sonner";
import { authClient } from "@/lib/client/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message || "Invalid email or password", { duration: 5000 });
        return;
      }

      toast.success("Signed in successfully");
      router.push("/app");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.", { duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

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
        disabled={isGithubLoading || isLoading}
      >
        {isGithubLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Github className="h-4 w-4" />
        )}
        Continue with GitHub
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[12px] text-text-tertiary whitespace-nowrap">OR</span>
        <div className="h-px flex-1 bg-border/60" />
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

        <FormField
          label="Password"
          type="password"
          placeholder="Enter your password"
          register={register("password")}
          error={errors.password}
          autoComplete="current-password"
          disabled={isLoading}
          value={watch("password") || ""}
        />

        <div className="flex items-center justify-end">
          <span className="text-[12px] text-text-tertiary cursor-not-allowed select-none" title="Reset password coming soon">
            Forgot password?
          </span>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full h-11 text-[14px]"
          disabled={!isValid || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

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
