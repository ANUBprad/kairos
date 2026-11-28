import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { GithubIcon } from "./brand-icons";
import { DOCS_URL, GITHUB_URL } from "./links";

const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pipeline", href: "/#workflow" },
      { label: "Sources", href: "/#sources" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Support", href: "/support" },
      { label: "FAQ", href: "/#faq" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Sign up", href: "/signup" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Billing", href: "/settings/billing" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="kairos-dark-section kairos-footer relative isolate overflow-hidden border-t border-border">
      <div aria-hidden="true" className="kairos-footer-atmosphere" />

      <div className="kairos-section-wrap relative z-10 pb-[19rem] pt-16 sm:pb-[22rem] sm:pt-20 lg:pb-[24rem]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)] lg:gap-16">
          <div className="max-w-sm">
            <Link href="/" className="flex h-fit items-center" aria-label="Kairos home">
              <KairosLogo
                size={28}
                textSize="text-xl"
                textColor="text-foreground"
                iconClassName="text-primary"
                subtitle="Research workspace"
              />
            </Link>

            <p className="mt-6 text-base leading-relaxed text-foreground">
              An AI-powered research and knowledge workspace.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Add sources, ask cited questions, and turn the same library into
              study material and an interruptible podcast.
            </p>

            <Link href="/signup" className="kairos-button kairos-button-primary mt-7">
              Start researching
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
              <span>&copy; {year} Kairos</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-border" />
              <span>Evidence-first by design</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-primary motion-reduce:transition-none"
              >
                Documentation
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Kairos on GitHub"
                className="inline-flex transition-colors hover:text-primary motion-reduce:transition-none"
              >
                <GithubIcon />
              </a>
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-8"
          >
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
                        className="text-[13px] text-muted-foreground transition-colors hover:text-primary motion-reduce:transition-none"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>

      <div aria-hidden="true" className="kairos-footer-wordmark">
        Kairos
      </div>
    </footer>
  );
}
