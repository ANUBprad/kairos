"use client";

import React from "react";
import { Workspace } from "@/hooks/use-workspaces";
import { WorkspaceCard } from "./workspace-card";
import { CreateWorkspaceCard } from "./create-workspace-card";

interface WorkspacesGridProps {
  workspaces: Workspace[];
  isLoading: boolean;
  pinnedIds: string[];
  menuOpenId: string | null;
  onMenuToggle: (workspaceId: string) => void;
  onCreateClick: () => void;
  onEdit: (workspace: Workspace, e: React.MouseEvent) => void;
  onTogglePin: (workspaceId: string, e: React.MouseEvent) => void;
  onDelete: (workspace: Workspace, e: React.MouseEvent) => void;
}

export function WorkspacesGrid({
  workspaces,
  isLoading,
  pinnedIds,
  menuOpenId,
  onMenuToggle,
  onCreateClick,
  onEdit,
  onTogglePin,
  onDelete,
}: WorkspacesGridProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kairos-eyebrow">Library</p>
          <h2 className="kairos-section-title mt-1.5 text-xl text-foreground sm:text-2xl">
            Your notebooks
          </h2>
        </div>
        <span className="kairos-tag">{workspaces.length} total</span>
      </div>

      {isLoading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading notebooks…</span>
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
            aria-hidden="true"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="kairos-inset h-44 space-y-3 p-5">
                <div className="kairos-shimmer h-5 w-2/3 rounded-lg" />
                <div className="kairos-shimmer h-4 w-4/5 rounded-lg" />
                <div className="kairos-shimmer mt-8 h-3 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {workspaces.length === 0 && (
            <p className="kairos-panel px-5 py-4 text-sm text-muted-foreground">
              No notebooks to show. Create one to get started, or try a different search.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {/* Create New Notebook Card */}
            <CreateWorkspaceCard onClick={onCreateClick} />

            {/* Workspace Cards */}
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                isPinned={pinnedIds.includes(ws.id)}
                isMenuOpen={menuOpenId === ws.id}
                onMenuToggle={onMenuToggle}
                onEdit={onEdit}
                onTogglePin={onTogglePin}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
