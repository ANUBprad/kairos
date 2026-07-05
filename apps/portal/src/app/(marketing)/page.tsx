import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { CTASection } from "@/components/marketing/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <FeaturesGrid />
      <CTASection />
    </>
  );
}
