import { requireSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";

export const metadata = {
  title: "Welcome to Kairos",
};

export default async function OnboardingPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }
  if (!session) redirect("/login");

  return <OnboardingClient />;
}
