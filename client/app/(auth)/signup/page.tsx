import { Metadata } from "next";
import { AuthLayout } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a Kairos workspace and bring your research sources together.",
};

export default function SignupPage() {
  return <AuthLayout mode="signup" />;
}
