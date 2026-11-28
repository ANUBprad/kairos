import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { getSession } from "@/features/auth/lib/auth-server";
import { SiteNav, SiteFooter } from "@/components/home";
import { PricingPlans } from "@/features/billing/components/pricing-plans";

export const metadata = {
  title: "Pricing & Credits — Kairos",
  description:
    "Pay-as-you-go credits for research. Free credits arrive each server-defined window, one-time credit packs never expire, and plan access is a finite one-time purchase — no recurring subscription.",
};

const PRICING_FAQS = [
  {
    question: "How are credits spent?",
    answer:
      "Source uploads and chat queries each cost one credit. Standard artifacts cost three, compute-heavy artifacts five, and an audio debate ten. Searching, browsing and connecting sources do not spend credits.",
  },
  {
    question: "When do free credits reset?",
    answer:
      "Free credits arrive in server-defined windows. The next reset time comes from your account snapshot, and unused free-window credits expire at that reset.",
  },
  {
    question: "Do purchased credits expire?",
    answer:
      "No. One-time credit packs never expire. Free-window credits are spent before paid credits.",
  },
  {
    question: "Is Kairos Pro a subscription?",
    answer:
      "No. Kairos Pro and Pro+ are one-time purchases with a 30-day access window. There is no automatic renewal or recurring billing.",
  },
  {
    question: "When are credits added after payment?",
    answer:
      "Kairos creates the order, you complete it in Razorpay, and the payment is verified on the server before credits are added.",
  },
  {
    question: "Can I choose an exact top-up amount?",
    answer:
      "Custom amounts are snapped to the closest allow-listed credit pack before checkout. Every amount is validated by the server.",
  },
];

export default async function PricingPage() {
  const session = await getSession();
  const isAuthenticated = !!session;
  const startHref = isAuthenticated ? "/dashboard" : "/signup";
  const startLabel = isAuthenticated ? "Open dashboard" : "Start researching";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav isAuthenticated={isAuthenticated} />

      <main className="kairos-aurora relative flex-1 overflow-hidden">
        <div className="kairos-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40" />

        <div className="kairos-section-wrap relative pb-24 pt-32 sm:pt-40">
          <header className="max-w-3xl">
            <span className="kairos-kicker">Pricing / Credits</span>
            <h1 className="kairos-editorial-title mt-6 text-[44px] sm:text-[64px] lg:text-[72px]">
              Credits for the work,
              <br />
              <span className="text-primary">not the calendar.</span>
            </h1>
            <p className="kairos-lede mt-6">
              Kairos spends credits on generation: uploads, cited answers,
              artifacts and audio. Free credits arrive in server-defined windows,
              while one-time packs stay in your account until you use them.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={startHref} className="kairos-button kairos-button-primary">
                {startLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="#pricing-plans" className="kairos-button kairos-button-secondary">
                Compare credits
              </Link>
            </div>
          </header>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-xs text-muted-foreground">
            <span>Free-window credits set by the server</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>Paid top-ups never expire</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>No recurring subscription</span>
          </div>

          <section id="pricing-plans" className="mt-16 scroll-mt-24" aria-labelledby="plans-heading">
            <h2 id="plans-heading" className="sr-only">
              Kairos credit plans and pricing
            </h2>
            <PricingPlans variant="page" showHeader={false} />
          </section>

          <section className="mt-20 grid gap-8 border-t border-border pt-10 lg:grid-cols-[0.8fr_1.2fr]" aria-labelledby="how-pricing-works">
            <div>
              <p className="kairos-eyebrow">How it works</p>
              <h2
                id="how-pricing-works"
                className="kairos-editorial-title mt-3 text-3xl sm:text-4xl"
              >
                Simple accounting,
                <br />
                clear limits.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="kairos-panel p-5">
                <h3 className="kairos-section-title text-base text-foreground">
                  Free windows
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Free credits arrive on a cadence set by the server. The next
                  reset is shown in your account, and unused window credits
                  expire at that point.
                </p>
              </div>
              <div className="kairos-panel p-5">
                <h3 className="kairos-section-title text-base text-foreground">
                  One-time purchases
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Credit packs never expire. Plan access is a separate one-time
                  30-day window. Neither renews automatically.
                </p>
              </div>
            </div>
          </section>

          <section className="pricing-faq mt-20" aria-labelledby="pricing-faq-heading">
            <div className="pricing-section-head">
              <div>
                <p className="kairos-eyebrow">FAQ</p>
                <h2
                  id="pricing-faq-heading"
                  className="kairos-section-title mt-1.5 text-xl text-foreground"
                >
                  Questions before you start
                </h2>
              </div>
            </div>

            <div className="mt-2">
              {PRICING_FAQS.map((item) => (
                <details key={item.question}>
                  <summary className="flex items-center justify-between gap-6 py-5 text-sm font-medium">
                    {item.question}
                    <ChevronDown
                      className="size-4 shrink-0 text-primary transition-transform duration-200 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="max-w-2xl pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section className="kairos-panel mt-20 overflow-hidden p-8 text-center sm:p-12" aria-labelledby="pricing-final-cta">
            <p className="kairos-kicker">Get started</p>
            <h2
              id="pricing-final-cta"
              className="kairos-editorial-title mt-4 text-3xl sm:text-5xl"
            >
              Bring your sources.
              <br />
              Keep the receipts.
            </h2>
            <p className="kairos-lede mx-auto mt-4">
              Create a workspace and see what Kairos can answer from your own
              library.
            </p>
            <Link href={startHref} className="kairos-button kairos-button-primary mt-7">
              {startLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
