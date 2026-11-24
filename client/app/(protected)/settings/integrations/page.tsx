import type { Metadata } from "next";
import { IntegrationsSettingsView } from "@/features/integrations";

export const metadata: Metadata = {
  title: "Integrations — Kairos",
  description:
    "Review saved Kairos connections for Drive, Notion, and GitHub, and manage how you add sources.",
};

export default function IntegrationsSettingsPage() {
  return <IntegrationsSettingsView />;
}
