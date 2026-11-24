import type { Metadata } from "next";
import { BillingSettingsView } from "@/features/billing";

export const metadata: Metadata = {
  title: "Credits & Billing — Kairos",
  description:
    "Review your Kairos credits, transaction history, and top-up options. Credits never expire, with no recurring subscription.",
};

export default function BillingSettingsPage() {
  return <BillingSettingsView />;
}
