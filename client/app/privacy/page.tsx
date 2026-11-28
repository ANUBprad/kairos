import type { Metadata } from "next";
import { SimpleInfoPage } from "@/components/brand/simple-info-page";
import { DOCS_URL } from "@/components/home/links";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <SimpleInfoPage eyebrow="Kairos" title="Privacy">
      <p>
        Account details, workspaces, uploaded sources, conversations and usage
        records are stored in the database configured for this deployment.
      </p>
      <p>
        External AI, search, storage and payment providers receive only the data
        required by the features that are configured and used. This deployment
        does not publish a separate privacy policy; contact the operator for
        deployment-specific questions.
      </p>
      <p>
        <a className="font-semibold text-primary underline" href={DOCS_URL}>
          Review setup and provider configuration
        </a>
      </p>
    </SimpleInfoPage>
  );
}
