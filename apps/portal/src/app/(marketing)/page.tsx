import { Hero } from "@/components/marketing/hero";
import { SocialProof } from "@/components/marketing/social-proof";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { EngineVisualization } from "@/components/marketing/engine-visualization";
import { Benchmarks } from "@/components/marketing/benchmarks";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { UseCasesGrid } from "@/components/marketing/use-cases-grid";
import { ArchitectureSection } from "@/components/marketing/architecture-section";
import { Integrations } from "@/components/marketing/integrations";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FAQSection } from "@/components/marketing/faq-section";
import { CTASection } from "@/components/marketing/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <Problem />
      <HowItWorks />
      <EngineVisualization />
      <Benchmarks />
      <FeaturesGrid />
      <UseCasesGrid />
      <ArchitectureSection />
      <Integrations />
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
