"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import {
  MoreVertical,
  Edit3,
  Pin,
  Trash2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { Workspace } from "@/hooks/use-workspaces";
import { WorkspaceIcon } from "@/features/workspaces/components/notebook-icon-picker";

interface WorkspaceCardProps {
  workspace: Workspace;
  isPinned: boolean;
  isMenuOpen: boolean;
  onMenuToggle: (workspaceId: string) => void;
  onEdit: (workspace: Workspace, e: React.MouseEvent) => void;
  onTogglePin: (workspaceId: string, e: React.MouseEvent) => void;
  onDelete: (workspace: Workspace, e: React.MouseEvent) => void;
}

export function WorkspaceCard({
  workspace,
  isPinned,
  isMenuOpen,
  onMenuToggle,
  onEdit,
  onTogglePin,
  onDelete,
}: WorkspaceCardProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        "kairos-card group relative flex h-44 flex-col justify-between p-5",
        isPinned && "outline-2 outline-offset-2 outline-brand/40"
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="kairos-inset flex h-9 w-9 shrink-0 items-center justify-center">
              <WorkspaceIcon
                value={workspace.icon}
                size={20}
                className="text-brand"
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Link
                href={`/workspace/${workspace.id}`}
                className="kairos-section-title truncate text-sm text-foreground transition-colors hover:text-brand"
              >
                {workspace.title}
              </Link>
              {isPinned && (
                <Pin
                  className="h-3 w-3 shrink-0 rotate-45 fill-brand text-brand"
                  aria-label="Pinned"
                />
              )}
            </div>
          </div>

          {/* Three Dots Menu Container */}
          <div className="relative shrink-0" ref={isMenuOpen ? menuRef : undefined}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuToggle(workspace.id);
              }}
              title="Notebook actions"
              aria-label="Notebook actions"
              aria-expanded={isMenuOpen}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* Action Dropdown Menu */}
            {isMenuOpen && (
              <div className="kairos-panel absolute right-0 top-full z-40 mt-2 w-44 animate-fadeIn motion-reduce:animate-none p-1.5 text-xs text-foreground">
                <button
                  type="button"
                  onClick={(e) => onEdit(workspace, e)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-brand-soft"
                >
                  <Edit3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Edit Notebook</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => onTogglePin(workspace.id, e)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-brand-soft"
                >
                  <Pin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>{isPinned ? "Unpin from top" : "Pin to top"}</span>
                </button>

                <div className="my-1 h-px bg-border" aria-hidden="true" />

                <button
                  type="button"
                  onClick={(e) => onDelete(workspace, e)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-danger transition-colors hover:bg-danger/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {workspace.description || "No description provided."}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatDate(workspace.updatedAt || workspace.createdAt)}
        </span>

        <Link
          href={`/workspace/${workspace.id}`}
          className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-brand"
        >
          <span>Open</span>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
