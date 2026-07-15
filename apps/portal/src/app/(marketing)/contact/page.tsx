import type { Metadata } from "next";
import { SectionWrapper } from "@/components/marketing/section-wrapper";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Kairos team for support, partnerships, or general inquiries.",
};

export default function ContactPage() {
  return (
    <>
      <SectionWrapper>
        <div className="text-center py-20 px-6 sm:px-8">
          <h1 className="text-[40px] font-semibold text-text-primary mb-4">Contact Us</h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Have questions about Kairos? We&apos;d love to hear from you.
          </p>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="max-w-2xl mx-auto px-6 sm:px-8 pb-20">
          <Card className="p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">General Inquiries</h2>
                <p className="text-text-secondary">
                  For general questions about Kairos, partnerships, or press inquiries,
                  email us at{" "}
                  <a href="mailto:hello@kairos.dev" className="text-brand hover:underline">
                    hello@kairos.dev
                  </a>
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">Technical Support</h2>
                <p className="text-text-secondary">
                  For technical issues or feature requests, open an issue on{" "}
                  <a
                    href="https://github.com/ANUBprad/kairos/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    GitHub
                  </a>
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">Security</h2>
                <p className="text-text-secondary">
                  To report a security vulnerability, email{" "}
                  <a href="mailto:security@kairos.dev" className="text-brand hover:underline">
                    security@kairos.dev
                  </a>
                </p>
              </div>
            </div>
          </Card>
        </div>
      </SectionWrapper>
    </>
  );
}
