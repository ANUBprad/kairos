import type { Metadata } from "next";
import { MemorySettingsView } from "@/features/memory";

export const metadata: Metadata = {
  title: "Memory & Insights — Kairos",
  description:
    "Review and manage the long-term memory profile that personalizes your Kairos answers and study preferences.",
};

export default function MemorySettingsPage() {
  return <MemorySettingsView />;
}
