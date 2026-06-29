import type { Metadata } from "next";
import { Mail, MessageSquare, Github } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/marketing/contact-form";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Contact | Kairos",
  description: "Get in touch with the Kairos team. Sales inquiries, support, and general questions.",
};

const contactMethods = [
  {
    icon: Mail,
    title: "Email",
    desc: "For sales inquiries and partnerships",
    action: "sales@kairos.dev",
    href: "mailto:sales@kairos.dev",
  },
  {
    icon: MessageSquare,
    title: "Discord",
    desc: "Community support and discussions",
    action: "Join our Discord",
    href: "https://discord.gg/kairos",
  },
  {
    icon: Github,
    title: "GitHub",
    desc: "Report issues and contribute",
    action: "Open an issue",
    href: "https://github.com/kairos-ai/kairos",
  },
];

export default function ContactPage() {
  return (
    <div className="pt-28 pb-24">
      <div className="mx-auto max-w-[720px] px-6 sm:px-8 text-center">
        <ScrollReveal>
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Contact Us</h1>
          <p className="mt-4 text-[18px] text-text-secondary">Get in touch with the Kairos team. We&apos;ll get back to you within 24 hours.</p>
        </ScrollReveal>
      </div>

      <div className="mt-16 mx-auto max-w-[600px] px-6 sm:px-8 space-y-4">
        {contactMethods.map((method, i) => {
          const Icon = method.icon;
          return (
            <ScrollReveal key={method.title} delay={i * 0.08}>
              <Card className="flex items-center gap-4 border-border/60">
                <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-brand/10 shrink-0">
                  <Icon size={16} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">{method.title}</h3>
                  <p className="text-xs text-text-tertiary">{method.desc}</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={method.href} target={method.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    {method.action}
                  </a>
                </Button>
              </Card>
            </ScrollReveal>
          );
        })}
      </div>

      <div className="mt-16 mx-auto max-w-[600px] px-6 sm:px-8">
        <ContactForm />
      </div>
    </div>
  );
}
