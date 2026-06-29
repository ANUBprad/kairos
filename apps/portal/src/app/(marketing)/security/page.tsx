import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldCheck, Key, Server, Bug } from "lucide-react";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal, StaggerContainer } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Security",
  description: "Kairos security practices: encryption, compliance, access control, and infrastructure security.",
};

const sections = [
  {
    icon: Lock,
    title: "Encryption",
    desc: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256. API keys are hashed with SHA-256 and stored securely. Database connections are encrypted and isolated per tenant.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance",
    desc: "SOC 2 compliance for Enterprise plans. GDPR compliant with data processing agreements. Data residency options available for EU, US, and APAC regions. Regular third-party audits.",
  },
  {
    icon: Key,
    title: "Access Control",
    desc: "API key-based authentication with per-project scoping. JWT-based session management with short-lived tokens. Rate limiting per key prevents abuse. Keys can be revoked instantly.",
  },
  {
    icon: Server,
    title: "Infrastructure",
    desc: "Isolated containers per tenant with resource limits. Encrypted PostgreSQL databases with automated backups. Regular security patches and penetration testing. 99.9% uptime SLA on Enterprise plans.",
  },
  {
    icon: Bug,
    title: "Vulnerability Disclosure",
    desc: "We maintain an active vulnerability disclosure program. Security researchers can report findings to security@kairos.dev with 24-hour acknowledgment and prompt remediation.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <div className="pt-28 pb-8 text-center px-6 sm:px-8">
        <ScrollReveal>
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Security</h1>
          <p className="mt-4 text-[18px] text-text-secondary max-w-2xl mx-auto">
            Your data is encrypted, isolated, and protected at every layer of the Kairos platform.
          </p>
        </ScrollReveal>
      </div>

      <SectionWrapper>
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-5" staggerDelay={0.08}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.title}>
                <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-brand/10 mb-4">
                  <Icon size={16} className="text-brand" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">{section.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{section.desc}</p>
              </Card>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      <div className="text-center py-20 px-6 sm:px-8">
        <ScrollReveal>
          <h2 className="text-[24px] font-semibold text-text-primary mb-4">Have security questions?</h2>
          <p className="text-text-secondary mb-8">Contact our security team for detailed information about our practices.</p>
          <Button variant="primary" size="lg" asChild>
            <Link href="/contact">Contact Security Team</Link>
          </Button>
        </ScrollReveal>
      </div>
    </>
  );
}
