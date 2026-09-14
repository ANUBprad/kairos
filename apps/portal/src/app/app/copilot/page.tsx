import { redirect } from "next/navigation";

export const metadata = {
  title: "AI Research Copilot",
};

export default function CopilotRedirectPage() {
  redirect("/app/knowledge-bases");
}