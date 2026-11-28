import { getSession } from "@/features/auth/lib/auth-server";
import { SiteNav, SiteFooter } from "@/components/home";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { PricingPlans } from "@/features/billing/components/pricing-plans";

export const metadata = {
  title: "Pricing & Credits — Kairos",
  description:
    "Pay-as-you-go credits for research. Free credits arrive each server-defined window, one-time credit packs never expire, and plan access is a finite one-time purchase — no recurring subscription.",
};

export default async function PricingPage() {
  const session = await getSession();
  const isAuthenticated = !!session;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav isAuthenticated={isAuthenticated} />

      <main className="kairos-aurora relative flex-1 overflow-hidden px-4 pb-20 pt-28 sm:px-6">
        <div className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col items-center gap-4 text-center sm:mb-10">
            <KairosLogo subtitle="Research credits" />
            <p className="kairos-eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 backdrop-blur">
              Pay-as-you-go pricing
            </p>
            <h1 className="kairos-display max-w-2xl text-3xl sm:text-4xl">
              Credits that follow your work, not a subscription.
            </h1>
          </div>

          <section className="kairos-panel px-5 py-6 sm:px-10 sm:py-10">
            <PricingPlans variant="page" />
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
