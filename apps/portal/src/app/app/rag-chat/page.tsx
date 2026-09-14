import { redirect } from "next/navigation";

export const metadata = {
  title: "AI Chat",
};

export default function RagChatRedirectPage() {
  redirect("/app/knowledge-bases");
}