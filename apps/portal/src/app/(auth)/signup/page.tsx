import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth-utils";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  const session = await getServerSession();
  // Anonymous visitors are allowed here: an account is optional, and this is
  // one of the ways to upgrade an anonymous session.
  if (session?.user?.id && !session.user.isAnonymous) redirect("/app");
  return <SignupForm />;
}