import type { Metadata } from "next";
import { SimpleInfoPage } from "@/components/brand/simple-info-page";
import { DOCS_URL, GITHUB_URL } from "@/components/home/links";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <SimpleInfoPage eyebrow="Kairos" title="Support">
      <p>
        Setup instructions and the list of supported providers are in the
        repository documentation. For bugs and setup questions, use the project
        issue tracker.
      </p>
      <p>
        <a className="font-semibold text-[#101318] underline" href={DOCS_URL}>
          Documentation
        </a>
        {" · "}
        <a
          className="font-semibold text-[#101318] underline"
          href={`${GITHUB_URL}/issues`}
        >
          Report an issue
        </a>
      </p>
    </SimpleInfoPage>
  );
}
