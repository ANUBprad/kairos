import React from "react";
import Link from "next/link";
import { KairosLogo } from "./kairos-logo";

interface SimpleInfoPageProps {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}

export function SimpleInfoPage({ eyebrow, title, children }: SimpleInfoPageProps) {
  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <KairosLogo
          size={28}
          textColor="text-foreground"
          iconClassName="text-primary"
        />
        <p className="mt-14 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">
          {eyebrow}
        </p>
        <h1 className="kairos-display mt-3 text-[34px] sm:text-[40px]">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground-secondary">
          {children}
        </div>
        <Link
          href="/login"
          className="mt-10 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
