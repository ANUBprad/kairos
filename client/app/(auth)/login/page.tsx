import { Metadata } from "next";
import { AuthLayout } from "@/features/auth";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to continue your Kairos research workspaces.",
};

export default function LoginPage() {
  return <AuthLayout mode="login" />;
}
