import type { Metadata } from "next";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy — Kairos",
  description: "How Kairos collects, uses, and protects your data.",
};

const PLACEHOLDER = "[[PROJECT_OWNER: Update with your actual practices]]";

export default function PrivacyPage() {
  return (
    <>
      <SectionWrapper>
        <div className="text-center py-20 px-6 sm:px-8">
          <h1 className="text-[40px] font-semibold text-text-primary mb-4">Privacy Policy</h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Last updated: {PLACEHOLDER}
          </p>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-20 space-y-8">
          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Information We Collect</h2>
            <p className="text-text-secondary">
              Kairos collects information you provide directly: account information (email, name),
              documents you upload, knowledge bases you create, and conversations with AI features.
              We may collect usage data such as page views, session duration, and feature usage patterns.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">How We Use Your Data</h2>
            <p className="text-text-secondary">
              Your data is used to provide and improve the Kairos platform. We do not sell your data
              to third parties. Uploaded documents are processed for RAG features and stored securely.
              AI provider interactions are used solely to generate responses for your requests.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Data Sharing</h2>
            <p className="text-text-secondary">
              We may share your data with service providers necessary to operate the platform,
              including database hosting, AI model providers (e.g., OpenAI, Google Gemini), and
              analytics services. These providers are contractually obligated to handle your data
              in accordance with our instructions.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Data Security</h2>
            <p className="text-text-secondary">
              We use industry-standard encryption, secure authentication, and access controls.
              Your documents are encrypted at rest and in transit. Authentication credentials are
              handled by Better Auth with secure cookie attributes.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Cookies and Tracking</h2>
            <p className="text-text-secondary">
              We use essential cookies for authentication and session management. We may use
              analytics tools (e.g., PostHog) to understand how visitors use the platform.
              Analytics tracking is disabled unless you consent via our cookie consent banner.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Data Retention</h2>
            <p className="text-text-secondary">
              We retain your data for as long as your account is active and as necessary to
              provide our services. You may request deletion of your data by contacting us.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Third-Party Services</h2>
            <p className="text-text-secondary">
              Kairos integrates with third-party services including AI model providers,
              cloud storage, and analytics platforms. These services may collect and process
              data as described in their own privacy policies.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Your Rights</h2>
            <p className="text-text-secondary">
              Depending on your jurisdiction, you may have the right to access, correct, or delete
              your personal data. Contact us at privacy@kairos.dev to exercise these rights.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Contact</h2>
            <p className="text-text-secondary">
              For privacy-related inquiries, contact us at{" "}
              <a href="mailto:privacy@kairos.dev" className="text-brand hover:underline">
                privacy@kairos.dev
              </a>
              . {PLACEHOLDER}
            </p>
          </Card>
        </div>
      </SectionWrapper>
    </>
  );
}
