import type { Metadata } from "next";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using the Kairos platform.",
};

export default function TermsPage() {
  return (
    <>
      <SectionWrapper>
        <div className="text-center py-20 px-6 sm:px-8">
          <h1 className="text-[40px] font-semibold text-text-primary mb-4">Terms of Service</h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Last updated: July 15, 2026
          </p>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-20 space-y-8">
          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Acceptance of Terms</h2>
            <p className="text-text-secondary">
              By accessing or using Kairos, you agree to be bound by these Terms of Service.
              If you do not agree, do not use the platform.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">User Responsibilities</h2>
            <p className="text-text-secondary">
              You are responsible for maintaining the security of your account, for all activity
              that occurs under your account, and for complying with all applicable laws.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Intellectual Property</h2>
            <p className="text-text-secondary">
              You retain ownership of all documents and content you upload to Kairos.
              We do not claim ownership over your data.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Limitation of Liability</h2>
            <p className="text-text-secondary">
              Kairos is provided &quot;as is&quot; without warranties. We are not liable for any
              indirect, incidental, or consequential damages arising from your use of the platform.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Contact</h2>
            <p className="text-text-secondary">
              For questions about these terms, contact us at{" "}
              <a href="mailto:legal@kairos.dev" className="text-brand hover:underline">
                legal@kairos.dev
              </a>
            </p>
          </Card>
        </div>
      </SectionWrapper>
    </>
  );
}
