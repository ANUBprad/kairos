import type { Metadata } from "next";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kairos collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <SectionWrapper>
        <div className="text-center py-20 px-6 sm:px-8">
          <h1 className="text-[40px] font-semibold text-text-primary mb-4">Privacy Policy</h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Last updated: July 15, 2026
          </p>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-20 space-y-8">
          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Data We Collect</h2>
            <p className="text-text-secondary">
              We collect information you provide directly: account information (email, name),
              documents you upload, knowledge bases you create, and conversations with AI features.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">How We Use Your Data</h2>
            <p className="text-text-secondary">
              Your data is used to provide and improve the Kairos platform. We do not sell your data
              to third parties. Uploaded documents are processed for RAG features and stored securely.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Data Security</h2>
            <p className="text-text-secondary">
              We use industry-standard encryption, secure authentication, and access controls.
              Your documents are encrypted at rest and in transit.
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Contact</h2>
            <p className="text-text-secondary">
              For privacy-related inquiries, contact us at{" "}
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
