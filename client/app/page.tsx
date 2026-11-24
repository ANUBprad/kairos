import { getSession } from "@/features/auth/lib/auth-server";
import {
  SiteNav,
  Hero,
  IntegrationsStrip,
  GroundingIntro,
  FeatureRows,
  Faq,
  SiteFooter,
} from "@/components/home";

export const metadata = {
  title: "Research with receipts",
  description:
    "Kairos turns your PDFs, pages, and transcripts into cited answers, study material, and a podcast you can interrupt.",
};

export default async function HomePage() {
  const session = await getSession();
  const isAuthenticated = !!session;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav isAuthenticated={isAuthenticated} />

      <main className="flex-1">
        <Hero isAuthenticated={isAuthenticated} />
        <IntegrationsStrip />
        <GroundingIntro />
        <FeatureRows />
        <Faq />
      </main>

      <SiteFooter />
    </div>
  );
}
