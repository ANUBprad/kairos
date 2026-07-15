import type { Metadata } from "next";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Kairos uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <>
      <SectionWrapper>
        <div className="text-center py-20 px-6 sm:px-8">
          <h1 className="text-[40px] font-semibold text-text-primary mb-4">Cookie Policy</h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Last updated: July 15, 2026
          </p>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-20 space-y-8">
          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">What Are Cookies</h2>
            <p className="text-text-secondary">
              Cookies are small text files stored on your device when you visit a website.
              They help us provide a better experience and understand how our platform is used.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Essential Cookies</h2>
            <p className="text-text-secondary">
              We use essential cookies for authentication, session management, and security.
              These are necessary for the platform to function and cannot be disabled.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Analytics Cookies</h2>
            <p className="text-text-secondary">
              We use PostHog analytics to understand how users interact with our platform.
              This helps us improve the product. You can opt out of analytics tracking in your
              account settings.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Managing Cookies</h2>
            <p className="text-text-secondary">
              You can control cookies through your browser settings. Disabling essential cookies
              may affect platform functionality.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Contact</h2>
            <p className="text-text-secondary">
              For questions about our cookie policy, contact us at{" "}
              <a href="mailto:privacy@kairos.dev" className="text-brand hover:underline">
                privacy@kairos.dev
              </a>
            </p>
          </Card>
        </div>
      </SectionWrapper>
    </>
  );
}
