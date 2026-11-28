"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { cn } from "@/lib/utils";
import { GithubIcon } from "./brand-icons";
import { DOCS_URL, GITHUB_URL } from "./links";

interface SiteNavProps {
  isAuthenticated?: boolean;
}

const NAV_LINKS = [
  { href: "/#workflow", label: "Pipeline" },
  { href: "/#features", label: "Features" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteNav({ isAuthenticated = false }: SiteNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaHref = isAuthenticated ? "/dashboard" : "/login";
  const ctaLabel = isAuthenticated ? "Dashboard" : "Log in";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl transition-colors duration-300",
        (isScrolled || isMenuOpen) && "bg-background/95"
      )}
    >
      <div className="kairos-section-wrap flex h-16 items-center justify-between">
        <Link href="/" aria-label="Kairos home" className="flex items-center">
          <KairosLogo
            size={26}
            textSize="text-[17px]"
            textColor="text-foreground"
            iconClassName="text-primary"
          />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Docs
            <ArrowUpRight className="size-3" />
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Kairos on GitHub"
            className="hidden text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            <GithubIcon />
          </a>
          <div className="[&_button]:border-border [&_button]:bg-surface/60 [&_button]:text-foreground [&_button]:hover:bg-surface-hover">
            <ThemeToggle />
          </div>
          <Link
            href={ctaHref}
            className="kairos-button kairos-button-light hidden px-4 py-2 text-[13px] sm:inline-flex"
          >
            {ctaLabel}
            <ArrowUpRight className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground transition-colors hover:bg-surface-hover hover:text-primary lg:hidden"
          >
            {isMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <nav
          className="border-t border-border bg-background/95 px-5 py-4 backdrop-blur-xl lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-primary"
            >
              Docs
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-primary"
            >
              GitHub
              <ArrowUpRight className="size-4" />
            </a>
            <Link
              href={ctaHref}
              onClick={() => setIsMenuOpen(false)}
              className="kairos-button kairos-button-light mt-2 justify-between rounded-xl px-3 py-2.5 sm:hidden"
            >
              {ctaLabel}
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
