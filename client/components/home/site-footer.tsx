import React from "react";
import Link from "next/link";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { GithubIcon } from "./brand-icons";
import { DOCS_URL, GITHUB_URL } from "./links";

const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Workspace",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Sources", href: "/#sources" },
      { label: "Studio", href: "/#studio" },
      { label: "Podcast", href: "/#podcast" },
      { label: "Cited chat", href: "/#chat" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Billing", href: "/settings/billing" },
      { label: "Integrations", href: "/settings/integrations" },
      { label: "Memory", href: "/settings/memory" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { label: "Pipeline", href: "/#workflow" },
      { label: "Grounding", href: "/#grounding" },
      { label: "Features", href: "/#features" },
      { label: "Use cases", href: "/#use-cases" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    heading: "Kairos",
    links: [
      { label: "Support", href: "/support" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="kairos-dark-section border-t border-border">
      <div className="kairos-section-wrap py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <Link href="/" className="flex h-fit items-center" aria-label="Kairos home">
              <KairosLogo
                size={28}
                textSize="text-xl"
                textColor="text-foreground"
                iconClassName="text-primary"
                subtitle="Research workspace"
              />
            </Link>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Turn scattered sources into answers you can verify and material you
              can actually use.
            </p>
            <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
              Evidence-first by design
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                  {column.heading}
                </h2>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-border pt-6 text-[12px] text-muted-foreground/80 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Kairos</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/pricing" className="transition-colors hover:text-primary">
              Simple, pay-as-you-go credits
            </Link>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-primary"
            >
              Docs
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Kairos on GitHub"
              className="transition-colors hover:text-primary"
            >
              <GithubIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
