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
      { label: "Workflow", href: "/#workflow" },
      { label: "Grounding", href: "/#grounding" },
      { label: "Features", href: "/#features" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="px-4 pb-6 sm:px-6">
      <div className="kairos-panel mx-auto w-full max-w-6xl px-7 py-12 sm:px-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <Link href="/" className="flex h-fit items-center" aria-label="Kairos home">
              <KairosLogo size={26} textSize="text-xl" subtitle="Research workspace" />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Turn scattered sources into answers you can verify and material you
              can actually use.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <p className="kairos-eyebrow">{column.heading}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
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

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Kairos</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              Simple, pay-as-you-go credits
            </Link>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-foreground"
            >
              Docs
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Kairos on GitHub"
              className="transition-colors hover:text-foreground"
            >
              <GithubIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
