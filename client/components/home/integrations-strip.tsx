import React from "react";
import { IntegrationsCarousel } from "./integrations-carousel";
import { ScrollReveal } from "./scroll-motion";

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
              Authorized accounts and source material land in one library. The
              services behind extraction and retrieval work quietly on that
              material so answers keep their citations.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120} className="mt-12">
          <IntegrationsCarousel />
        </ScrollReveal>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Connections are managed in workspace settings
        </p>
      </div>
    </section>
  );
}
