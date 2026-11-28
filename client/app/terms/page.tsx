import type { Metadata } from "next";
import { SimpleInfoPage } from "@/components/brand/simple-info-page";
import { DOCS_URL } from "@/components/home/links";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <SimpleInfoPage eyebrow="Kairos" title="Terms">
      <p>
        This deployment does not publish a separate terms-of-service document.
        Kairos is provided as source code, and the repository documentation
        describes the setup and the functionality that is actually implemented.
      </p>
      <p>
        No additional licence grant or service commitment is made by this page.
        For deployment-specific questions, use the project issue tracker linked
        from the documentation.
      </p>
      <p>
        <a className="font-semibold text-[#101318] underline" href={DOCS_URL}>
          Read the repository documentation
        </a>
      </p>
    </SimpleInfoPage>
  );
}
