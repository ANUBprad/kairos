import React from "react";
import Link from "next/link";
import { ArrowUpRight, Layers3, Quote, Sparkles } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { AuthForm } from "./auth-form";

interface AuthLayoutProps {
  mode: "login" | "signup";
}

const PRINCIPLES = [
  { icon: Quote, label: "Cited by default" },
  { icon: Layers3, label: "One source library" },
  { icon: Sparkles, label: "Study material on demand" },
];

export function AuthLayout({ mode }: AuthLayoutProps) {
  return (
    <main className="kairos-aurora flex min-h-screen w-full items-center justify-center bg-background p-3 text-foreground sm:p-5 lg:p-6">
      <div className="kairos-panel relative flex w-full max-w-6xl flex-col overflow-hidden lg:flex-row">
        <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-brand-quiet p-10 lg:flex xl:p-14">
          <div className="kairos-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative z-10">
            <KairosLogo size={28} textSize="text-xl" subtitle="Research workspace" />
          </div>

          <div className="relative z-10 max-w-xl">
            <span className="kairos-eyebrow">Evidence-first research</span>
            <h2 className="kairos-display mt-4 text-[34px] xl:text-[42px]">
              Good research deserves a trail you can follow.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Bring your material in once. Ask questions, verify every answer, and
              turn the same library into material you can study and share.
            </p>
            <Link
              href="/#workflow"
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-brand-accent"
            >
              Explore the workflow
              <ArrowUpRight className="size-4" />
            </Link>
          </div>

          <div className="relative z-10 flex flex-wrap gap-2">
            {PRINCIPLES.map((principle) => (
              <span key={principle.label} className="kairos-tag">
                <principle.icon className="size-3.5" />
                {principle.label}
              </span>
            ))}
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-surface lg:w-125 xl:w-140">
          <React.Suspense fallback={<div className="min-h-160 w-full" />}>
            <AuthForm initialMode={mode} />
          </React.Suspense>
        </section>
      </div>
    </main>
  );
}
