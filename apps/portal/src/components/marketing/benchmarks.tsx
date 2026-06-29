"use client";

import { motion } from "framer-motion";
import { SectionWrapper, SectionHeading, SectionSubheading } from "./section-wrapper";
import { ScrollReveal, StaggerContainer, staggerItem } from "@/components/shared/scroll-reveal";

const metrics = [
  { value: "+24%", label: "Recall Improvement", color: "text-success" },
  { value: "163ms", label: "Average Latency", color: "text-info" },
  { value: "-40%", label: "Cost Reduction", color: "text-warning" },
  { value: "99.2%", label: "Success Rate", color: "text-brand" },
];

const domains = [
  { name: "General", value: 94, color: "bg-brand" },
  { name: "Technical", value: 91, color: "bg-info" },
  { name: "Legal", value: 92, color: "bg-success" },
  { name: "Medical", value: 88, color: "bg-warning" },
  { name: "Finance", value: 85, color: "bg-error" },
];

export function Benchmarks() {
  return (
    <SectionWrapper id="benchmarks">
      <ScrollReveal>
        <SectionHeading>Benchmarked across five domains</SectionHeading>
        <SectionSubheading>
          Validated on legal, medical, finance, technical, and general knowledge datasets.
        </SectionSubheading>
      </ScrollReveal>

      <StaggerContainer className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4" staggerDelay={0.08}>
        {metrics.map((metric) => (
          <motion.div
            key={metric.label}
            variants={staggerItem()}
            className="text-center rounded-xl border border-border bg-surface/50 p-6"
          >
            <div className={`text-[28px] font-bold ${metric.color} mb-1`}>{metric.value}</div>
            <div className="text-[12px] text-text-tertiary font-medium">{metric.label}</div>
          </motion.div>
        ))}
      </StaggerContainer>

      <ScrollReveal className="mt-12">
        <div className="rounded-xl border border-border bg-surface/50 p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-6">Recall by Domain</h3>
          <div className="space-y-4">
            {domains.map((domain, i) => (
              <div key={domain.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary font-medium">{domain.name}</span>
                  <span className="text-text-primary font-semibold">{domain.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${domain.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full ${domain.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
