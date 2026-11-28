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
      { label: "Workflow", href: "/#workflow" },
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
    <footer className="kairos-footer relative isolate overflow-hidden border-t border-border">
      <div aria-hidden="true" className="kairos-footer-atmosphere" />

      <div className="kairos-section-wrap kairos-footer-content relative z-10">
        <div className="kairos-footer-topline">
          <span>The research workspace</span>
          <span>Black + orange, evidence first</span>
        </div>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)] lg:gap-16">
          <div className="max-w-sm">
            <Link href="/" className="flex h-fit items-center" aria-label="Kairos home">
              <KairosLogo
                size={30}
                textSize="text-[22px]"
                textColor="text-foreground"
                iconClassName="text-primary"
                subtitle="Research workspace"
              />
            </Link>

            <p className="kairos-footer-statement">
              One library. Every answer traceable.
            </p>
            <p className="kairos-footer-description">
              Kairos reads across your sources, returns cited answers, and turns
              the same material into study artifacts and an interruptible
              podcast.
            </p>

            <Link href="/signup" className="kairos-button kairos-button-primary mt-7">
              Start researching
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>

            <div className="kairos-footer-meta">
              <span>&copy; {year} Kairos</span>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-8"
          >
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <h2 className="kairos-footer-heading">{column.heading}</h2>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="kairos-footer-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="kairos-footer-bottom">
          <span>Connections are managed in workspace settings.</span>
          <div className="flex items-center gap-5">
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
      </div>

      <div aria-hidden="true" className="kairos-footer-wordmark">
        Kairos
      </div>
    </footer>
  );
}
