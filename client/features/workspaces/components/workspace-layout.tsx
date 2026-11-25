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
  const prevSourcesLength = useRef(0);

  const {
    workspace,
    isLoading: isWorkspaceLoading,
    updateWorkspace,
  } = useWorkspace(workspaceId);

  const sourcesQuery = useSources(workspaceId);
  const sources = useMemo(() => sourcesQuery.data || [], [sourcesQuery.data]);
  const isSourcesLoading = sourcesQuery.isLoading;

  const storageKey = `openbook_selected_sources_${workspaceId}`;

  // Initial load: restore persisted selection or default to all sources
  useEffect(() => {
    if (sources.length > 0 && !initialSelectionDone.current) {
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              // Keep only source IDs that still exist in current workspace sources
              const valid = parsed.filter((id) =>
                sources.some((s) => s.id === id)
              );
              setSelectedSourceIds(valid);
              initialSelectionDone.current = true;
              return;
            }
          }
        } catch {}
      }
      // If first time, default to all sources and persist
      const allIds = sources.map((s) => s.id);
      setSelectedSourceIds(allIds);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(allIds));
        } catch {}
      }
      initialSelectionDone.current = true;
    }
  }, [sources, storageKey]);

  // Helper to update selection and persist to localStorage
  const updateAndPersistSelection = useCallback(
    (updater: (prev: string[]) => string[]) => {
      setSelectedSourceIds((prev) => {
        const next = updater(prev);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    [storageKey],
  );

  // When newly created/imported sources appear, include them in selection and persist
  useEffect(() => {
    if (sources.length > prevSourcesLength.current && prevSourcesLength.current > 0) {
      updateAndPersistSelection((prev) => {
        const allIds = sources.map((s) => s.id);
        const added = allIds.filter((id) => !prev.includes(id));
        return [...prev, ...added];
      });
    }
    prevSourcesLength.current = sources.length;
  }, [sources, updateAndPersistSelection]);

  const uploadPdfMutation = useUploadPdfSource(workspaceId);
  const importWebsiteMutation = useImportWebsiteSource(workspaceId);
  const importYoutubeMutation = useImportYoutubeSource(workspaceId);
  const createSourceMutation = useCreateSource(workspaceId);
  const deleteSourceMutation = useDeleteSource(workspaceId);

  const toggleSourceSelection = (id: string) => {
    updateAndPersistSelection((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllSources = () => {
    const allIds = sources.map((s) => s.id);
    updateAndPersistSelection(() => allIds);
  };

  const deselectAllSources = () => {
    updateAndPersistSelection(() => []);
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
              selectedSourceIds={selectedSourceIds}
              onToggleSelect={toggleSourceSelection}
              onSelectAll={selectAllSources}
              onDeselectAll={deselectAllSources}
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
              selectedSourcesCount={selectedSourceIds.length}
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
                  sourceIds: selectedSourceIds,
                })
              }
              onDeleteArtifact={deleteArtifact}
              onRetryArtifact={retryArtifact}
              isCreating={isArtifactCreating}
              isRetrying={isArtifactRetrying}
              retryingArtifactId={retryingArtifactId}
              selectedSourcesCount={selectedSourceIds.length}
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
                selectedSourceIds={selectedSourceIds}
                onToggleSelect={toggleSourceSelection}
                onSelectAll={selectAllSources}
                onDeselectAll={deselectAllSources}
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
                selectedSourcesCount={selectedSourceIds.length}
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
                    sourceIds: selectedSourceIds,
                  })
                }
                onDeleteArtifact={deleteArtifact}
                onRetryArtifact={retryArtifact}
                isCreating={isArtifactCreating}
                isRetrying={isArtifactRetrying}
                retryingArtifactId={retryingArtifactId}
                selectedSourcesCount={selectedSourceIds.length}
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
