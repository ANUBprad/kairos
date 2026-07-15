"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal, StaggerContainer, staggerItem } from "@/components/shared/scroll-reveal";
import {
  PRICING_PLANS,
  getPlanPrice,
  type PricingPlan,
} from "@/lib/pricing/config";
import { getUserRegion } from "@/lib/pricing/actions";

export function PricingSection() {
  const [region, setRegion] = useState("DEFAULT");

  useEffect(() => {
    getUserRegion().then(setRegion).catch(() => {});
  }, []);

  return (
    <SectionWrapper id="pricing">
      <ScrollReveal>
        <SectionHeading>Free and open-source</SectionHeading>
        <SectionSubheading>
          Built for AI research and education. Always free. MIT licensed.
        </SectionSubheading>
      </ScrollReveal>

      <StaggerContainer className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.06}>
        {PRICING_PLANS.map((plan: PricingPlan) => {
          const price = getPlanPrice(plan, region);
          return (
            <motion.div
              key={plan.id}
              variants={staggerItem()}
              className={`relative rounded-[14px] border p-6 flex flex-col transition-all duration-300 ${
                plan.popular
                  ? "border-brand/40 bg-brand/[0.03] shadow-glow"
                  : "border-border bg-surface/50"
              }`}
            >
              {plan.popular && (
                <Badge variant="brand" className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-text-primary mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[32px] font-bold text-text-primary">{price.formatted}</span>
                  {price.amount > 0 && <span className="text-xs text-text-tertiary">/mo</span>}
                </div>
                <p className="text-xs text-text-tertiary">{plan.description}</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={14} className="text-success mt-0.5 shrink-0" />
                    <span className="text-xs text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>
              <Button variant={plan.popular ? "primary" : "ghost"} size="md" className="w-full" asChild>
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </motion.div>
          );
        })}
      </StaggerContainer>

      <ScrollReveal className="mt-6 text-center">
        <p className="text-xs text-text-tertiary">
          All plans billed monthly. Annual billing available at 20% discount.
          No credit card required for Free plan.
        </p>
      </ScrollReveal>
    </SectionWrapper>
  );
}
