"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Check } from "lucide-react";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal, StaggerContainer, staggerItem } from "@/components/shared/scroll-reveal";

const plans = [
  {
    name: "Free",
    price: "$0",
    desc: "Perfect for testing and small projects.",
    features: [
      "1,000 queries / month",
      "3 strategies",
      "Community support",
      "Basic analytics",
    ],
    cta: "Get started",
    href: "/signup",
    variant: "ghost" as const,
    popular: false,
  },
  {
    name: "Developer",
    price: "$49",
    desc: "For individual developers and small teams.",
    features: [
      "10,000 queries / month",
      "All 3 strategies",
      "Confidence calibration",
      "Email support",
      "API access",
    ],
    cta: "Start building",
    href: "/signup",
    variant: "ghost" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: "$199",
    desc: "For growing teams that need more power.",
    features: [
      "100,000 queries / month",
      "Multi-strategy engine",
      "Feedback learning loop",
      "Priority support",
      "Custom strategies",
      "Full observability",
    ],
    cta: "Start building",
    href: "/signup",
    variant: "primary" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For organizations with advanced requirements.",
    features: [
      "Unlimited queries",
      "Custom strategy development",
      "SOC 2 compliance",
      "Dedicated support",
      "Self-hosting options",
      "SLA guarantees",
    ],
    cta: "Contact sales",
    href: "/contact",
    variant: "secondary" as const,
    popular: false,
  },
];

export function PricingSection() {
  return (
    <SectionWrapper id="pricing">
      <ScrollReveal>
        <SectionHeading>Simple, transparent pricing</SectionHeading>
        <SectionSubheading>
          Start free. Upgrade when you grow. Enterprise when you need control.
        </SectionSubheading>
      </ScrollReveal>

      <StaggerContainer className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.06}>
        {plans.map((plan) => (
          <motion.div
            key={plan.name}
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
                <span className="text-[32px] font-bold text-text-primary">{plan.price}</span>
                {plan.price !== "Custom" && <span className="text-xs text-text-tertiary">/mo</span>}
              </div>
              <p className="text-xs text-text-tertiary">{plan.desc}</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={14} className="text-success mt-0.5 shrink-0" />
                  <span className="text-xs text-text-secondary">{f}</span>
                </li>
              ))}
            </ul>
            <Button variant={plan.variant} size="md" className="w-full" asChild>
              <Link href={plan.href}>{plan.cta}</Link>
            </Button>
          </motion.div>
        ))}
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
