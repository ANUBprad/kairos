import type { Metadata } from "next";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Service — Kairos",
  description: "Terms and conditions for using the Kairos platform.",
};

const PLACEHOLDER = "[[PROJECT_OWNER: Update with your actual legal details]]";

export default function TermsPage() {
  return (
    <>
      <SectionWrapper>
        <div className="text-center py-20 px-6 sm:px-8">
          <h1 className="text-[40px] font-semibold text-text-primary mb-4">Terms of Service</h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Last updated: {PLACEHOLDER}
          </p>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-20 space-y-8">
          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Acceptance of Terms</h2>
            <p className="text-text-secondary">
              By accessing or using Kairos, you agree to be bound by these Terms of Service.
              If you do not agree, do not use the platform. {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">User Accounts</h2>
            <p className="text-text-secondary">
              You are responsible for maintaining the security of your account, for all activity
              that occurs under your account, and for complying with all applicable laws.
              You must be at least 13 years old to use the platform.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Organization and Workspace Responsibilities</h2>
            <p className="text-text-secondary">
              If you are part of an organization or workspace on Kairos, you are responsible
              for the content and activity within that workspace. You must ensure that all
              members comply with these terms.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Uploaded Content</h2>
            <p className="text-text-secondary">
              You retain ownership of all documents and content you upload to Kairos.
              You grant Kairos a license to process and store your content solely to provide
              the service. You are responsible for the content you upload and its compliance
              with applicable laws.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Prohibited Use</h2>
            <p className="text-text-secondary">
              You agree not to use the platform for any illegal or unauthorized purpose,
              including but not limited to: uploading harmful or malicious content,
              attempting to circumvent security measures, or using the platform to generate
              misleading or harmful information.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">AI-Generated Output</h2>
            <p className="text-text-secondary">
              AI-generated content on Kairos may contain inaccuracies or errors.
              Kairos does not guarantee the accuracy, completeness, or reliability of
              AI-generated output. You are responsible for verifying any output before use.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Service Availability</h2>
            <p className="text-text-secondary">
              Kairos is provided "as is" and "as available." We do not guarantee that the
              platform will be uninterrupted, error-free, or secure. We may suspend or
              discontinue the platform at any time.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Third-Party Services</h2>
            <p className="text-text-secondary">
              Kairos integrates with third-party services including AI model providers,
              cloud storage, and analytics platforms. These services are subject to their
              own terms and privacy policies. {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Account Termination</h2>
            <p className="text-text-secondary">
              We may terminate or suspend your account at any time, with or without cause,
              immediately upon notice. Upon termination, your access to the platform will
              cease. You may request deletion of your data by contacting us.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Data Deletion</h2>
            <p className="text-text-secondary">
              You may request deletion of your personal data and associated content.
              Upon request, we will delete your data from active systems within a reasonable
              timeframe. Backup systems may retain data for a limited period.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Intellectual Property</h2>
            <p className="text-text-secondary">
              Kairos and its original content, features, and functionality are the property
              of Kairos. All trademarks, service marks, and logos are the property of their
              respective owners.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Limitation of Liability</h2>
            <p className="text-text-secondary">
              To the maximum extent permitted by law, Kairos is not liable for any
              indirect, incidental, special, consequential, or punitive damages arising
              from your use of the platform.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Changes to Terms</h2>
            <p className="text-text-secondary">
              We may update these Terms of Service at any time. We will notify you of
              material changes via email or by posting a notice on the platform. Your
              continued use of the platform after changes constitutes acceptance of the
              updated terms.
              {PLACEHOLDER}
            </p>
          </Card>

          <Card className="p-8 space-y-4">
            <h2 className="text-xl font-semibold text-text-primary">Contact</h2>
            <p className="text-text-secondary">
              For questions about these terms, contact us at{" "}
              <a href="mailto:legal@kairos.dev" className="text-brand hover:underline">
                legal@kairos.dev
              </a>
              . {PLACEHOLDER}
            </p>
          </Card>
        </div>
      </SectionWrapper>
    </>
  );
}
