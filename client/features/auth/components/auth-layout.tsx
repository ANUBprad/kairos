import React from "react";
import Link from "next/link";
import { ArrowUpRight, Layers3, Quote, Sparkles } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { AuthForm } from "./auth-form";

interface AuthLayoutProps {
  mode: "login" | "signup";
}

const PRINCIPLES = [
  {
    icon: Quote,
    label: "Cited by default",
    detail: "Answers stay connected to the sources they came from.",
  },
  {
    icon: Layers3,
    label: "One source library",
    detail: "Documents, sites and repositories live in one place.",
  },
  {
    icon: Sparkles,
    label: "Create from evidence",
    detail: "Turn the same material into study and working outputs.",
  },
];

function stagger(ms: number): React.CSSProperties {
  return { "--auth-delay": `${ms}ms` } as React.CSSProperties;
}

export function AuthLayout({ mode }: AuthLayoutProps) {
  return (
    <main className="min-h-dvh w-full bg-background text-foreground">
      <div className="flex min-h-dvh w-full flex-col lg:flex-row">
        <section className="relative hidden min-h-dvh w-full overflow-hidden bg-editorial-bg text-editorial-ink lg:flex lg:w-[41%]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/login.jpg')" }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-editorial-bg/80" />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--editorial-ink) 12%, transparent), transparent 38%), radial-gradient(circle at 82% 84%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 42%)",
            }}
          />

          <div className="relative z-10 flex h-full w-full flex-col justify-between gap-12 p-10 xl:p-14">
            <div className="auth-rise">
              <KairosLogo
                size={30}
                textSize="text-xl"
                textColor="text-editorial-ink"
                iconClassName="text-primary"
                subtitle="Connected knowledge"
              />
            </div>

            <div className="max-w-xl">
              <span
                className="auth-rise text-[11px] font-semibold uppercase tracking-[0.2em] text-editorial-muted"
                style={stagger(60)}
              >
                Evidence-first research
              </span>
              <h1
                className="auth-rise kairos-display mt-5 text-[44px] leading-[1.02] text-editorial-ink xl:text-[54px]"
                style={stagger(120)}
              >
                Your knowledge.
                <br />
                Connected.
              </h1>
              <p
                className="auth-rise mt-6 max-w-md text-[15px] leading-relaxed text-editorial-muted"
                style={stagger(180)}
              >
                Bring your documents, sources and ideas together. Let AI help you
                find, understand and create more.
              </p>
              <Link
                href="/#workflow"
                className="auth-rise mt-8 inline-flex items-center gap-2 text-sm font-semibold text-editorial-ink transition-colors hover:text-primary"
                style={stagger(240)}
              >
                See how Kairos works
                <ArrowUpRight className="size-4" />
              </Link>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {PRINCIPLES.map((principle, index) => (
                <div
                  key={principle.label}
                  className="auth-rise rounded-2xl border border-editorial-border bg-editorial-surface/70 px-4 py-3 backdrop-blur-sm"
                  style={stagger(300 + index * 60)}
                >
                  <principle.icon className="size-4 text-primary" />
                  <span className="mt-2 block text-sm font-medium text-editorial-ink">
                    {principle.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-editorial-muted">
                    {principle.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-dvh w-full flex-col bg-background lg:w-[59%]">
          <div className="flex items-center justify-between px-6 py-5 sm:px-8 lg:hidden">
            <KairosLogo
              size={26}
              textSize="text-lg"
              textColor="text-foreground"
              iconClassName="text-primary"
            />
            <Link
              href="/pricing"
              className="text-xs font-semibold text-foreground-secondary transition-colors hover:text-primary"
            >
              Pricing
            </Link>
          </div>

          <div className="px-6 sm:px-8 lg:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">
              Evidence-first research
            </p>
            <h1 className="kairos-display mt-2 text-[30px] text-foreground">
              Your knowledge. Connected.
            </h1>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:py-14">
            <React.Suspense fallback={<div className="min-h-140 w-full max-w-105" />}>
              <AuthForm initialMode={mode} />
            </React.Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
