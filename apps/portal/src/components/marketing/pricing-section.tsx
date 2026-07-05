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
    desc: "Perfect for getting started with RAG.",
    features: [
      "Unlimited queries",
      "5 chunking strategies",
      "2 embedding providers",
      "Community support",
    ],
    cta: "Get started",
    href: "/signup",
    variant: "ghost" as const,
    popular: false,
  },
  {
    name: "Developer",
    price: "$0",
    desc: "For individual researchers and students.",
    features: [
      "All RAG strategies",
      "Embedding experiments",
      "Chunking studio",
      "Retrieval evaluation",
      "API access",
    ],
    cta: "Get started",
    href: "/signup",
    variant: "ghost" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: "$0",
    desc: "For advanced AI/ML research projects.",
    features: [
      "Multi-strategy engine",
      "Configurable embeddings",
      "Retrieval comparison",
      "Performance metrics",
      "Explainable pipeline",
      "Full observability",
    ],
    cta: "Start building",
    href: "/signup",
    variant: "primary" as const,
    popular: true,
  },
  {
    name: "Research",
    price: "Free",
    desc: "For academic research and AI/ML projects.",
    features: [
      "All features included",
      "Open-source codebase",
      "GitHub authentication",
      "Community support",
      "Self-hosting options",
      "MIT license",
    ],
    cta: "Get started",
    href: "/signup",
    variant: "secondary" as const,
    popular: false,
  },
];

export function PricingSection() {
  return (
    <SectionWrapper id="pricing">
      <ScrollReveal>
        <SectionHeading>Free and open-source</SectionHeading>
        <SectionSubheading>
          Built for AI research and education. Always free. MIT licensed.
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
