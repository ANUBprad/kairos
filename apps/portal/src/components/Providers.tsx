"use client";

import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { CommandPalette } from "@/components/ui/command-palette";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      {children}
      <CommandPalette />
    </WorkspaceProvider>
  );
}
