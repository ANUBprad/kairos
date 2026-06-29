"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export function CTASection() {
  return (
    <SectionWrapper className="text-center">
      <ScrollReveal>
        <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary max-w-3xl mx-auto leading-[1.2]">
          Stop over-engineering simple queries.
        </h2>
        <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary max-w-3xl mx-auto leading-[1.2] mt-1">
          Stop under-serving complex ones.
        </h2>
        <p className="mt-5 text-[18px] text-text-secondary max-w-xl mx-auto">
          One API call. Optimal strategy every time. Start free and see the difference.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="primary" size="lg" className="gap-2" asChild>
            <Link href="/signup">
              Start building
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/contact">Talk to sales</Link>
          </Button>
        </div>
        <div className="mt-6 flex items-center justify-center gap-5 text-xs text-text-tertiary">
          <span>No credit card required</span>
          <span className="w-1 h-1 rounded-full bg-text-tertiary/40" />
          <span>Cancel anytime</span>
          <span className="w-1 h-1 rounded-full bg-text-tertiary/40" />
          <span>1,000 free queries</span>
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
