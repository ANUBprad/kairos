import type { Metadata } from "next";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FAQSection } from "@/components/marketing/faq-section";
import { CTASection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free and open-source RAG research platform. Designed for AI/ML students, researchers, and practitioners.",
};

export default function PricingPage() {
  return (
    <>
      <div className="pt-24 text-center px-6 sm:px-8">
        <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Pricing</h1>
        <p className="mt-4 text-[18px] text-text-secondary max-w-xl mx-auto">
          Free and open-source. Built for RAG research and experimentation.
        </p>
      </div>
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
