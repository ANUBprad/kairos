import type { Metadata } from "next";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FAQSection } from "@/components/marketing/faq-section";
import { CTASection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for teams of all sizes. Start free. Upgrade when you grow. Enterprise when you need control.",
};

export default function PricingPage() {
  return (
    <>
      <div className="pt-24 text-center px-6 sm:px-8">
        <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Pricing</h1>
        <p className="mt-4 text-[18px] text-text-secondary max-w-xl mx-auto">
          Start free. Upgrade when you grow. Enterprise when you need control.
        </p>
      </div>
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
