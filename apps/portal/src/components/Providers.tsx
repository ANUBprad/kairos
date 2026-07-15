"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { CommandPalette } from "@/components/ui/command-palette";
import { PostHogProvider } from "@/lib/telemetry/analytics";

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
