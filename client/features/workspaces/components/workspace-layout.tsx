"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";


import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { WorkspaceHeader } from "./workspace-header";
import {
  SourcesPanel,
  useSources,
  useUploadPdfSource,
  useImportWebsiteSource,
  useImportYoutubeSource,
  useCreateSource,
  useDeleteSource,
} from "@/features/sources";
import { ChatPanel, useChat } from "@/features/chat";
import { StudioPanel, useArtifacts } from "@/features/learn";
import { useWorkspace } from "../hooks/use-workspace";
import {
  includeNewSourceIds,
  parsePersistedSelection,
  pruneSelectedSourceIds,
  selectedSourcesStorageKey,
} from "../lib/source-selection";
import { Layers, MessageSquare, Sparkles } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps {
  workspaceId: string;
}

type MobileTab = "sources" | "chat" | "studio";

export function WorkspaceLayout({ workspaceId }: WorkspaceLayoutProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const initialSelectionDone = useRef(false);
  const knownSourceIds = useRef<string[]>([]);

  const {
    workspace,
    isLoading: isWorkspaceLoading,
    updateWorkspace,
  } = useWorkspace(workspaceId);

  const sourcesQuery = useSources(workspaceId);
  const sources = useMemo(() => sourcesQuery.data || [], [sourcesQuery.data]);
  const isSourcesLoading = sourcesQuery.isLoading;

  const sourceIds = useMemo(() => sources.map((s) => s.id), [sources]);
  const storageKey = useMemo(
    () => selectedSourcesStorageKey(workspaceId),
    [workspaceId],
  );

  // The selection used for counts, chat and artifacts is always a subset of
  // the sources that actually exist in this workspace.
  const effectiveSelectedIds = useMemo(
    () => pruneSelectedSourceIds(selectedSourceIds, sourceIds),
    [selectedSourceIds, sourceIds],
  );

  const persistSelection = useCallback(
    (ids: string[]) => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(ids));
      } catch {}
    },
    [storageKey],
  );

  const updateAndPersistSelection = useCallback(
    (updater: (prev: string[]) => string[]) => {
      setSelectedSourceIds((prev) => {
        const next = updater(prev);
        if (next !== prev) persistSelection(next);
        return next;
      });
    },
    [persistSelection],
  );

  // A workspace switch starts from a clean selection for that workspace so
  // IDs from the previous workspace can never be counted or sent to chat.
  useEffect(() => {
    initialSelectionDone.current = false;
    knownSourceIds.current = [];
    setSelectedSourceIds([]);
  }, [workspaceId]);

  // Restore once per workspace, pruning IDs for sources that no longer exist.
  useEffect(() => {
    if (initialSelectionDone.current || sources.length === 0) return;
    let saved: string | null = null;
    if (typeof window !== "undefined") {
      try {
        saved = localStorage.getItem(storageKey);
      } catch {}
    }
    const restored = parsePersistedSelection(saved);
    const next = pruneSelectedSourceIds(restored ?? sourceIds, sourceIds);
    knownSourceIds.current = sourceIds;
    setSelectedSourceIds(next);
    persistSelection(next);
    initialSelectionDone.current = true;
  }, [sources.length, sourceIds, storageKey, persistSelection]);

  // Refresh on source-list changes: drop deleted IDs, include genuinely new
  // sources, and keep sources the user deselected untouched.
  useEffect(() => {
    if (!initialSelectionDone.current) return;
    const previouslyKnown = knownSourceIds.current;
    knownSourceIds.current = sourceIds;
    updateAndPersistSelection((prev) => {
      const next = includeNewSourceIds(prev, sourceIds, previouslyKnown);
      return next.length === prev.length && next.every((id, i) => id === prev[i])
        ? prev
        : next;
    });
  }, [sourceIds, updateAndPersistSelection]);

  const uploadPdfMutation = useUploadPdfSource(workspaceId);
  const importWebsiteMutation = useImportWebsiteSource(workspaceId);
  const importYoutubeMutation = useImportYoutubeSource(workspaceId);
  const createSourceMutation = useCreateSource(workspaceId);
  const deleteSourceMutation = useDeleteSource(workspaceId);

  const toggleSourceSelection = (id: string) => {
    updateAndPersistSelection((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectSources = (ids: string[]) => {
    updateAndPersistSelection((prev) =>
      pruneSelectedSourceIds([...prev, ...ids], sourceIds),
    );
  };

  const deselectSources = (ids: string[]) => {
    const removing = new Set(ids);
    updateAndPersistSelection((prev) =>
      prev.filter((id) => !removing.has(id)),
    );
  };
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    startNewChat,
    webSearchEnabled,
    setWebSearchEnabled,
    conversations,
    currentConversationId,
    setCurrentConversationId,
    deleteConversation,
    clearConversation,
  } = useChat(workspaceId, undefined, workspace?.defaultModel);

  const {
    artifacts,
    createArtifact,
    deleteArtifact,
    retryArtifact,
    isCreating: isArtifactCreating,
    isRetrying: isArtifactRetrying,
    retryingArtifactId,
  } = useArtifacts(workspaceId);

  const mobileTabClass = (tab: MobileTab) =>
    cn(
      "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
      mobileTab === tab
        ? "bg-brand-soft text-brand"
        : "text-muted-foreground hover:bg-brand-quiet hover:text-foreground",
    );

  if (isWorkspaceLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        <ThemeLoader size={36} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Workspace Header */}
      <WorkspaceHeader
        workspace={workspace || null}
        sourcesCount={sources.length}
        onUpdateTitle={(title) => updateWorkspace({ title })}
        onUpdateModel={(defaultModel) => updateWorkspace({ defaultModel })}
      />

      {/* Desktop / Tablet: 3-Column Resizable Split View */}
      <div className="hidden md:flex flex-1 min-h-0 w-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Left Panel: Sources */}
          <ResizablePanel
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
            className="min-w-55"
          >
            <SourcesPanel
              workspaceId={workspaceId}
              sources={sources}
              selectedSourceIds={effectiveSelectedIds}
              onToggleSelect={toggleSourceSelection}
              onSelectAll={selectSources}
              onDeselectAll={deselectSources}
              onUploadPdf={(file, title) => uploadPdfMutation.mutateAsync({ file, title })}
              onImportWebsite={(url, title) => importWebsiteMutation.mutateAsync({ url, title })}
              onImportYoutube={(url, title) => importYoutubeMutation.mutateAsync({ url, title })}
              onCreateTextSource={(title, content) =>
                createSourceMutation.mutateAsync({ type: "TEXT", title, content })
              }
              onDeleteSource={(id) => deleteSourceMutation.mutateAsync(id)}
              isLoading={isSourcesLoading}
            />
          </ResizablePanel>

          {/* Draggable Handle */}
          <ResizableHandle withHandle />

          {/* Middle Panel: Chat Interface */}
          <ResizablePanel defaultSize="52%" minSize="30%">
            <ChatPanel
              workspaceId={workspaceId}
              defaultModel={workspace?.defaultModel}
              onModelChange={(defaultModel) => updateWorkspace({ defaultModel })}
              messages={messages}
              isStreaming={isStreaming}
              onSendMessage={sendMessage}
              onStopStreaming={stopStreaming}
              onNewChat={startNewChat}
              selectedSourcesCount={effectiveSelectedIds.length}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={(id) => setCurrentConversationId(id || undefined)}
              onDeleteConversation={deleteConversation}
              onClearConversation={clearConversation}
            />
          </ResizablePanel>

          {/* Draggable Handle */}
          <ResizableHandle withHandle />

          {/* Right Panel: Studio & Artifacts */}
          <ResizablePanel
            defaultSize="26%"
            minSize="18%"
            maxSize="40%"
            className="min-w-55"
          >
            <StudioPanel
              artifacts={artifacts}
              onCreateArtifact={(type) =>
                createArtifact({
                  type,
                  sourceIds: effectiveSelectedIds,
                })
              }
              onDeleteArtifact={deleteArtifact}
              onRetryArtifact={retryArtifact}
              isCreating={isArtifactCreating}
              isRetrying={isArtifactRetrying}
              retryingArtifactId={retryingArtifactId}
              selectedSourcesCount={effectiveSelectedIds.length}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile View: Single Panel with Compact Tab Bar */}
      <div className="flex md:hidden flex-1 flex-col min-h-0 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden p-2 pb-1 sm:p-3 sm:pb-2">
          <div className="h-full overflow-hidden rounded-xl border border-border bg-panel">
            {mobileTab === "sources" && (
              <SourcesPanel
                workspaceId={workspaceId}
                sources={sources}
                selectedSourceIds={effectiveSelectedIds}
                onToggleSelect={toggleSourceSelection}
                onSelectAll={selectSources}
                onDeselectAll={deselectSources}
                onUploadPdf={(file, title) => uploadPdfMutation.mutateAsync({ file, title })}
                onImportWebsite={(url, title) => importWebsiteMutation.mutateAsync({ url, title })}
                onImportYoutube={(url, title) => importYoutubeMutation.mutateAsync({ url, title })}
                onCreateTextSource={(title, content) =>
                  createSourceMutation.mutateAsync({ type: "TEXT", title, content })
                }
                onDeleteSource={(id) => deleteSourceMutation.mutateAsync(id)}
                isLoading={isSourcesLoading}
              />
            )}

            {mobileTab === "chat" && (
              <ChatPanel
                workspaceId={workspaceId}
                defaultModel={workspace?.defaultModel}
                onModelChange={(defaultModel) => updateWorkspace({ defaultModel })}
                messages={messages}
                isStreaming={isStreaming}
                onSendMessage={sendMessage}
                onStopStreaming={stopStreaming}
                onNewChat={startNewChat}
                selectedSourcesCount={effectiveSelectedIds.length}
                webSearchEnabled={webSearchEnabled}
                onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
                conversations={conversations}
                currentConversationId={currentConversationId}
                onSelectConversation={(id) => setCurrentConversationId(id || undefined)}
                onDeleteConversation={deleteConversation}
                onClearConversation={clearConversation}
              />
            )}

            {mobileTab === "studio" && (
              <StudioPanel
                artifacts={artifacts}
                onCreateArtifact={(type) =>
                  createArtifact({
                    type,
                    sourceIds: effectiveSelectedIds,
                  })
                }
                onDeleteArtifact={deleteArtifact}
                onRetryArtifact={retryArtifact}
                isCreating={isArtifactCreating}
                isRetrying={isArtifactRetrying}
                retryingArtifactId={retryingArtifactId}
                selectedSourcesCount={effectiveSelectedIds.length}
              />
            )}
          </div>
        </div>

        <nav
          aria-label="Workspace panels"
          className="z-20 flex h-12 shrink-0 items-stretch gap-1 border-t border-border bg-panel px-2 py-1"
        >
          <button
            type="button"
            onClick={() => setMobileTab("sources")}
            aria-pressed={mobileTab === "sources"}
            className={mobileTabClass("sources")}
          >
            <Layers className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Sources ({sources.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            aria-pressed={mobileTab === "chat"}
            className={mobileTabClass("chat")}
          >
            <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab("studio")}
            aria-pressed={mobileTab === "studio"}
            className={mobileTabClass("studio")}
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Studio ({artifacts.length})</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
