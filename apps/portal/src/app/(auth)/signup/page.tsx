"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, SignupInput } from "@/lib/validation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { toast } from "sonner";
import { authClient } from "@/lib/client/auth-client";

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
  });

  const password = watch("password");

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);

    try {
      const { error } = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
          toast.error("An account with this email already exists", { duration: 5000 });
        } else {
          toast.error(error.message || "Failed to create account", { duration: 5000 });
        }
        return;
      }

      toast.success("Account created! Redirecting to dashboard...", { duration: 3000 });
      setTimeout(() => router.push("/app"), 1500);
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
          label="Full name"
          placeholder="Jane Doe"
          register={register("name")}
          error={errors.name}
          autoComplete="name"
          disabled={isLoading}
          maxChars={100}
          value={watch("name") || ""}
        />

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
          placeholder="Create a strong password"
          register={register("password")}
          error={errors.password}
          autoComplete="new-password"
          disabled={isLoading}
          value={password || ""}
          showPasswordRequirements
        />

        <FormField
          label="Confirm password"
          type="password"
          placeholder="Re-enter your password"
          register={register("passwordConfirm")}
          error={errors.passwordConfirm}
          autoComplete="new-password"
          disabled={isLoading}
          value={watch("passwordConfirm") || ""}
        />

        <div className="space-y-1">
          <label className="flex items-start gap-2.5 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              {...register("terms")}
              className="mt-0.5 accent-brand w-4 h-4"
              disabled={isLoading}
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-brand hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-brand hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.terms && (
            <p className="text-xs text-error flex items-center gap-1">
              {errors.terms.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full h-11 text-[14px]"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Creating account...
            </span>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

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
