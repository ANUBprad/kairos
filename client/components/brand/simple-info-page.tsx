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
    <main className="min-h-dvh bg-white px-6 py-10 text-[#101318] sm:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <KairosLogo
          size={28}
          textColor="text-[#101318]"
          iconClassName="text-[#101318]"
        />
        <p className="mt-14 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b8494]">
          {eyebrow}
        </p>
        <h1 className="kairos-display mt-3 text-[34px] sm:text-[40px]">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-[#4b5563]">
          {children}
        </div>
        <Link
          href="/login"
          className="mt-10 inline-flex rounded-xl bg-[#101318] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b3340]"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
