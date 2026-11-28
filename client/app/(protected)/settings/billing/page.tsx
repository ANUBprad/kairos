import type { Metadata } from "next";
import { BillingSettingsView } from "@/features/billing";

export const metadata: Metadata = {
  title: "Credits & Billing — Kairos",
  description:
    "Review your Kairos credits, transaction history, and one-time top-up options. Paid credits never expire; free-window credits reset on the server's schedule.",
};

export default function BillingSettingsPage() {
  return <BillingSettingsView />;
}
