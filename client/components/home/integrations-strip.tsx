import React from "react";
import { FileText, Globe } from "lucide-react";
import { IntegrationsCarousel } from "./integrations-carousel";
import { ScrollReveal } from "./scroll-motion";

const SOURCE_FORMATS = [
  { label: "PDFs", icon: FileText },
  { label: "Web pages", icon: Globe },
  { label: "Markdown & text", icon: FileText },
];

export function IntegrationsStrip() {
  return (
    <section
      id="sources"
      className="scroll-mt-24 overflow-hidden bg-background py-24 sm:py-28"
    >
      <div className="kairos-section-wrap">
        <ScrollReveal>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
            <div>
              <p className="kairos-kicker">Connected research</p>
              <h2 className="kairos-editorial-title mt-4 text-[34px] sm:text-[44px]">
                One library, however
                <br />
                your sources arrive.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Authorized accounts and source formats land in one library. The
              services behind extraction and retrieval work quietly on that
              material so answers keep their citations.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120} className="mt-12">
          <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>Connected accounts</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>Source types</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>Processing services</span>
          </div>
          <IntegrationsCarousel />
        </ScrollReveal>

        <ScrollReveal delay={180} className="mt-10 border-t border-border pt-8">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div className="flex gap-4">
              <span className="pt-0.5 font-mono text-[10px] tracking-[0.18em] text-processing-deep">
                02
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Files and links</h3>
                <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                  Add material directly, whether it starts as a file, page or transcript.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {SOURCE_FORMATS.map((format) => (
                <div
                  key={format.label}
                  className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-foreground"
                >
                  <format.icon className="size-4 text-primary" strokeWidth={1.6} />
                  <span>{format.label}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Connections are managed in workspace settings
        </p>
      </div>
    </section>
  );
}
