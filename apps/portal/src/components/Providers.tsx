"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { PostHogProvider } from "@/lib/telemetry/analytics";

const CommandPalette = dynamic(
  () => import("@/components/ui/command-palette").then((m) => m.CommandPalette),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Suspense fallback={null}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </Suspense>
      <CommandPalette />
    </WorkspaceProvider>
  );
}
