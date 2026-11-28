"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  ImageIcon,
  Globe,
  FileText,
  X,
  Search,
  Check,
  AlertCircle,
  HelpCircle,
  GitFork,
  Lock,
  Star,
  RefreshCw,
} from "lucide-react";

import { GithubIcon } from "@/components/ui/github-icon";

import { YoutubeIcon } from "@/components/ui/youtube-icon";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { cn } from "@/lib/utils";
import { dismissOnBackdropClick } from "@/lib/modal";
import {
  useCreateSource,
  useImportWebsiteSource,
  useImportYoutubeSource,
  useUploadPdfSource,
  useUploadImageSource,
  useImportGoogleDriveSource,
  useImportNotionSource,
  useImportGithubSource,
} from "../hooks/use-sources";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { NotionTokenGuideModal } from "./notion-token-guide-modal";
import {
  GoogleDriveIcon,
  NotionIcon,
} from "@/components/ui/integration-brand-icons";


export interface AddSourceDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workspaceId?: string;
  onUploadPdf?: (file: File, title?: string) => Promise<unknown>;
  onImportWebsite?: (url: string, title?: string) => Promise<unknown>;
  onImportYoutube?: (url: string, title?: string) => Promise<unknown>;
  onCreateTextSource?: (title: string, content: string) => Promise<unknown>;
}

type TabType =
  | "pdf"
  | "image"
  | "website"
  | "youtube"
  | "text"
  | "google-drive"
  | "notion"
  | "github";

const FORM_CONTROL_CLASSNAME =
  "kairos-inset w-full px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const IMAGE_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.heic,.heif";

const SOURCE_TABS: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
  { id: "pdf", label: "PDF", icon: <Upload className="size-5" /> },
  { id: "image", label: "Image", icon: <ImageIcon className="size-5" /> },
  {
    id: "google-drive",
    label: "Google Drive",
    icon: <GoogleDriveIcon size={20} className="scale-[2.25]" />,
  },
  {
    id: "notion",
    label: "Notion",
    icon: <NotionIcon size={20} className="scale-[1.55]" />,
  },
  { id: "website", label: "Web URL", icon: <Globe className="size-5" /> },
  { id: "youtube", label: "YouTube", icon: <YoutubeIcon size={20} /> },
  { id: "text", label: "Text", icon: <FileText className="size-5" /> },
  { id: "github", label: "GitHub", icon: <GithubIcon size={20} /> },
];

interface IntegrationsStatus {
  googleDrive: {
    connected: boolean;
    account?: { metadata?: { email?: string; name?: string } } | null;
  };
  notion: {
    connected: boolean;
    account?: { metadata?: { workspaceName?: string } } | null;
  };
  github: {
    connected: boolean;
    account?: { metadata?: { login?: string; name?: string } } | null;
  };
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  type: "GOOGLE_DOC" | "PDF";
  modifiedTime: string | null;
}

interface DriveFilesPage {
  files: DriveFile[];
  nextPageToken: string | null;
}

interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  updatedAt: string;
}

interface GithubReposPage {
  repos: GithubRepo[];
  nextPage: number | null;
  hasMore: boolean;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Keeps integration-dependent tabs from flashing a "connect" state while status loads. */
function IntegrationStatusGate({
  label,
  isLoading,
  isError,
  error,
  onRetry,
  children,
}: {
  label: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div
        role="status"
        className="kairos-inset flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground"
      >
        <ThemeLoader size={20} />
        <span>Checking your {label} connection…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="kairos-inset space-y-2 p-4 text-center">
        <AlertCircle className="mx-auto size-5 text-danger" aria-hidden="true" />
        <p className="text-xs font-medium text-foreground">
          Couldn&apos;t check your {label} connection.
        </p>
        <p className="text-[11px] text-muted-foreground">
          {getErrorMessage(error, "The provider rejected the request.")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mx-auto flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function AddSourceDialog({
  isOpen,
  onClose,
  open,
  onOpenChange,
  workspaceId,
  onUploadPdf,
  onImportWebsite,
  onImportYoutube,
  onCreateTextSource,
}: AddSourceDialogProps) {
  const isDialogOpen = open !== undefined ? open : (isOpen || false);

  const [activeTab, setActiveTab] = useState<TabType>("pdf");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hook-based mutations
  const uploadPdfMutation = useUploadPdfSource(workspaceId || "");
  const uploadImageMutation = useUploadImageSource(workspaceId || "");
  const importWebsiteMutation = useImportWebsiteSource(workspaceId || "");
  const importYoutubeMutation = useImportYoutubeSource(workspaceId || "");
  const createSourceMutation = useCreateSource(workspaceId || "");
  const importGoogleDriveMutation = useImportGoogleDriveSource(workspaceId || "");
  const importNotionMutation = useImportNotionSource(workspaceId || "");
  const importGithubMutation = useImportGithubSource(workspaceId || "");

  // Form states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageTitle, setImageTitle] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [webTitle, setWebTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  // Integration specific states
  const [driveSearch, setDriveSearch] = useState("");
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string | null>(null);
  const [notionSearch, setNotionSearch] = useState("");
  const [selectedNotionPageId, setSelectedNotionPageId] = useState<string | null>(null);
  const [notionTokenInput, setNotionTokenInput] = useState("");
  const [isConnectingNotion, setIsConnectingNotion] = useState(false);
  const [showNotionHelp, setShowNotionHelp] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubTitle, setGithubTitle] = useState("");


  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Query connected integrations
  const {
    data: integrations,
    isLoading: isLoadingIntegrations,
    isError: isIntegrationsError,
    error: integrationsError,
    refetch: refetchIntegrations,
  } = useQuery<IntegrationsStatus>({
    queryKey: ["connected-integrations"],
    queryFn: () => apiClient<IntegrationsStatus>("/api/integrations"),
    enabled: isDialogOpen,
  });

  // Debounce keystrokes and abort superseded requests instead of firing one
  // provider call per character.
  const debouncedDriveSearch = useDebouncedValue(driveSearch, 300);
  const driveFilesQuery = useInfiniteQuery<DriveFilesPage>({
    queryKey: ["google-drive-files", debouncedDriveSearch],
    queryFn: ({ pageParam, signal }) =>
      apiClient<DriveFilesPage>("/api/integrations/google-drive/files", {
        params: {
          search: debouncedDriveSearch || undefined,
          pageToken: typeof pageParam === "string" ? pageParam : undefined,
        },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    enabled:
      isDialogOpen && activeTab === "google-drive" && !!integrations?.googleDrive?.connected,
  });
  const driveFiles = driveFilesQuery.data?.pages.flatMap((page) => page.files) ?? [];

  // Query Notion pages when Notion tab is active and connected
  const {
    data: notionPagesData,
    isLoading: isLoadingNotionPages,
    isError: isNotionPagesError,
    error: notionPagesError,
    refetch: refetchNotionPages,
  } = useQuery<{
    pages: Array<{
      id: string;
      title: string;
      icon: string | null;
      lastEditedTime: string;
    }>;
  }>({
    queryKey: ["notion-pages", notionSearch],
    queryFn: () =>
      apiClient(`/api/integrations/notion/pages?search=${encodeURIComponent(notionSearch)}`),
    enabled: isDialogOpen && activeTab === "notion" && !!integrations?.notion?.connected,
  });

  // GitHub repository browsing state & query
  const [githubSearch, setGithubSearch] = useState("");
  const [selectedGithubRepoUrl, setSelectedGithubRepoUrl] = useState<string | null>(null);
  const [isManualGithubUrl, setIsManualGithubUrl] = useState(false);
  const debouncedGithubSearch = useDebouncedValue(githubSearch, 300);

  const githubReposQuery = useInfiniteQuery<GithubReposPage>({
    queryKey: ["github-repos", debouncedGithubSearch],
    queryFn: ({ pageParam, signal }) =>
      apiClient<GithubReposPage>("/api/integrations/github/repos", {
        params: {
          search: debouncedGithubSearch || undefined,
          page: typeof pageParam === "number" ? pageParam : undefined,
        },
        signal,
      }),
    initialPageParam: 1 as number,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    enabled: isDialogOpen && activeTab === "github" && !!integrations?.github?.connected,
  });
  const githubRepos = githubReposQuery.data?.pages.flatMap((page) => page.repos) ?? [];

  if (!isDialogOpen) return null;

  const resetForm = () => {
    setPdfFile(null);
    setPdfTitle("");
    setWebUrl("");
    setWebTitle("");
    setYoutubeUrl("");
    setYoutubeTitle("");
    setTextTitle("");
    setTextContent("");
    setDriveSearch("");
    setSelectedDriveFileId(null);
    setSelectedNotionPageId(null);
    setGithubUrl("");
    setGithubTitle("");
    setGithubSearch("");
    setSelectedGithubRepoUrl(null);
    setIsManualGithubUrl(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const handleConnectGoogleDrive = async () => {
    try {
      const res = await apiClient<{ url: string }>("/api/integrations/google-drive/auth-url");
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to get Google Drive auth URL."));
    }
  };

  const handleConnectGithub = async () => {
    try {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/dashboard";
      const res = await apiClient<{ url: string }>(
        `/api/integrations/github/auth-url?returnTo=${encodeURIComponent(returnTo)}`,
      );
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to get GitHub auth URL."));
    }
  };

  const handleConnectNotionToken = async () => {
    if (!notionTokenInput.trim()) {
      setError("Please enter a Notion internal integration token.");
      return;
    }
    setIsConnectingNotion(true);
    setError(null);
    try {
      await apiClient("/api/integrations/notion/connect", {
        method: "POST",
        body: JSON.stringify({ token: notionTokenInput.trim() }),
      });
      setNotionTokenInput("");
      await refetchIntegrations();
      await refetchNotionPages();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to connect Notion token."));
    } finally {
      setIsConnectingNotion(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const title = (value: string) => value.trim() || undefined;

    if (activeTab === "pdf" && !pdfFile) return setError("Please select a PDF file.");
    if (activeTab === "image" && !imageFile) return setError("Please select an image file.");
    if (activeTab === "website" && !webUrl.trim()) return setError("Please enter a valid website URL.");
    if (activeTab === "youtube" && !youtubeUrl.trim()) return setError("Please enter a valid YouTube video URL.");
    if (activeTab === "text" && (!textTitle.trim() || !textContent.trim())) {
      return setError("Please enter both a title and text content.");
    }
    if (activeTab === "google-drive" && !selectedDriveFileId) {
      return setError("Please select a Google Doc or PDF from the list.");
    }
    if (activeTab === "notion" && !selectedNotionPageId) {
      return setError("Please select a Notion page from the list.");
    }
    if (activeTab === "github" && !githubUrl.trim()) {
      return setError("Please enter a valid GitHub repository URL.");
    }

    setIsLoading(true);
    try {
      switch (activeTab) {
        case "pdf":
          await (onUploadPdf
            ? onUploadPdf(pdfFile!, title(pdfTitle))
            : uploadPdfMutation.mutateAsync({ file: pdfFile!, title: title(pdfTitle) }));
          break;
        case "image":
          await uploadImageMutation.mutateAsync({
            file: imageFile!,
            title: title(imageTitle),
          });
          break;
        case "website":
          await (onImportWebsite
            ? onImportWebsite(webUrl.trim(), title(webTitle))
            : importWebsiteMutation.mutateAsync({ url: webUrl.trim(), title: title(webTitle) }));
          break;
        case "youtube":
          await (onImportYoutube
            ? onImportYoutube(youtubeUrl.trim(), title(youtubeTitle))
            : importYoutubeMutation.mutateAsync({ url: youtubeUrl.trim(), title: title(youtubeTitle) }));
          break;
        case "text":
          await (onCreateTextSource
            ? onCreateTextSource(textTitle.trim(), textContent.trim())
            : createSourceMutation.mutateAsync({ type: "TEXT", title: textTitle.trim(), content: textContent.trim() }));
          break;
        case "google-drive":
          await importGoogleDriveMutation.mutateAsync(selectedDriveFileId!);
          break;
        case "notion":
          await importNotionMutation.mutateAsync(selectedNotionPageId!);
          break;
        case "github":
          await importGithubMutation.mutateAsync({
            url: githubUrl.trim(),
            title: title(githubTitle),
          });
          break;
      }
      handleClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to add source. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-overlay backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => dismissOnBackdropClick(e, handleClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-source-dialog-title"
        className="kairos-panel max-h-[calc(100vh-2rem)] w-full max-w-2xl animate-fadeIn overflow-y-auto text-foreground shadow-[var(--shadow-lift)] motion-reduce:animate-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <div className="min-w-0 space-y-0.5">
            <p className="kairos-eyebrow">Add knowledge</p>
            <h2
              id="add-source-dialog-title"
              className="kairos-section-title text-base text-primary"
            >
              Add source to Kairos
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close add source dialog"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-brand-quiet hover:text-brand motion-reduce:transition-none"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Source type grid — 4 × 2 */}
        <div className="select-none border-b border-border bg-brand-quiet px-4 py-4">
          <div role="group" aria-label="Source type" className="grid grid-cols-4 gap-2">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setError(null);
                }}
                aria-pressed={activeTab === tab.id}
                className={cn(
                  "flex min-h-[4.25rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-[11px] font-medium transition-colors motion-reduce:transition-none",
                  activeTab === tab.id
                    ? "border-brand bg-primary text-primary-foreground shadow-[var(--shadow-panel)]"
                    : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:bg-brand-soft hover:text-brand",
                )}
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center overflow-visible [&_svg]:size-5"
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
                <span className="text-center leading-snug line-clamp-2">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              className="animate-fadeIn rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive motion-reduce:animate-none"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* 1. PDF Upload */}
          {activeTab === "pdf" && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPdfFile(file);
                    if (!pdfTitle) setPdfTitle(file.name.replace(/\.[^/.]+$/, ""));
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors motion-reduce:transition-none",
                  pdfFile
                    ? "border-brand bg-brand-quiet text-brand"
                    : "border-border hover:border-brand/50 hover:bg-brand-quiet"
                )}
              >
                <Upload className="size-8 text-brand" aria-hidden="true" />
                <span className="block text-xs font-medium text-primary">
                  {pdfFile ? pdfFile.name : "Click to browse or drop a PDF here"}
                </span>
                <span className="block text-[11px] text-muted-foreground">Up to 25 MB</span>
              </button>

              <div>
                <label htmlFor="pdf-title" className="mb-1 block text-xs font-medium text-foreground">
                  Source Title (Optional)
                </label>
                <input
                  id="pdf-title"
                  type="text"
                  placeholder="e.g. Research Paper"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>
            </div>
          )}

          {activeTab === "image" && (
            <div className="space-y-4">
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    if (!imageTitle) {
                      setImageTitle(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors motion-reduce:transition-none",
                  imageFile
                    ? "border-brand bg-brand-quiet text-brand"
                    : "border-border hover:border-brand/50 hover:bg-brand-quiet"
                )}
              >
                <ImageIcon className="size-8 text-brand" aria-hidden="true" />
                <span className="block text-xs font-medium text-primary">
                  {imageFile ? imageFile.name : "Upload a photo, scan, or screenshot"}
                </span>
                <span className="block text-[11px] text-muted-foreground max-w-sm">
                  Supports PNG, JPG, WEBP, GIF, and more — up to 15MB.
                </span>
              </button>

              <div>
                <label htmlFor="image-title" className="mb-1 block text-xs font-medium text-foreground">
                  Source Title (Optional)
                </label>
                <input
                  id="image-title"
                  type="text"
                  placeholder="e.g. Lecture slide photo"
                  value={imageTitle}
                  onChange={(e) => setImageTitle(e.target.value)}
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>
            </div>
          )}

          {/* 2. Google Drive */}
          {activeTab === "google-drive" && (
            <IntegrationStatusGate
              label="Google Drive"
              isLoading={isLoadingIntegrations}
              isError={isIntegrationsError}
              error={integrationsError}
              onRetry={() => void refetchIntegrations()}
            >
              <div className="space-y-4">
              {!integrations?.googleDrive?.connected ? (
                <div className="space-y-4 rounded-2xl border border-border bg-brand-quiet p-8 text-center">
                  <GoogleDriveIcon size={48} className="mx-auto" />
                  <div className="space-y-1">
                    <h3 className="kairos-section-title text-sm text-primary">
                      Connect your Google Drive
                    </h3>
                    <p className="mx-auto max-w-sm text-[11px] text-muted-foreground">
                      Import Google Docs and PDFs directly into your Kairos sources with one click.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectGoogleDrive}
                    className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 motion-reduce:transition-none"
                  >
                    Connect Google Drive
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      aria-label="Search Google Drive files"
                      placeholder="Search Google Drive docs & PDFs..."
                      value={driveSearch}
                      onChange={(e) => {
                        setDriveSearch(e.target.value);
                        setSelectedDriveFileId(null);
                      }}
                      className={cn(FORM_CONTROL_CLASSNAME, "pl-8 pr-3")}
                    />
                  </div>

                  {driveFilesQuery.isFetching && !driveFilesQuery.isLoading && (
                    <p role="status" className="text-[11px] text-muted-foreground">
                      Updating Drive files…
                    </p>
                  )}

                  {driveFilesQuery.isError ? (
                    <div role="alert" className="kairos-inset space-y-2 p-4 text-center">
                      <AlertCircle
                        className="mx-auto size-5 text-danger"
                        aria-hidden="true"
                      />
                      <p className="text-xs font-medium text-foreground">
                        Couldn&apos;t load Google Drive files.
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {getErrorMessage(
                          driveFilesQuery.error,
                          "The provider rejected the request.",
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => void driveFilesQuery.refetch()}
                        className="mx-auto flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none"
                      >
                        <RefreshCw className="size-3" aria-hidden="true" />
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div
                      role="listbox"
                      aria-label="Google Drive files"
                      className="kairos-inset max-h-52 overflow-y-auto"
                    >
                      {driveFilesQuery.isLoading ? (
                        <div className="p-6 text-center" role="status">
                          <ThemeLoader size={20} />
                        </div>
                      ) : driveFiles.length > 0 ? (
                        <>
                          {driveFiles.map((file) => {
                            const isSelected = selectedDriveFileId === file.id;
                            return (
                              <button
                                key={file.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => setSelectedDriveFileId(file.id)}
                                className={cn(
                                  "flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border p-2.5 text-left text-xs transition-colors last:border-b-0 motion-reduce:transition-none",
                                  isSelected
                                    ? "bg-brand-soft font-semibold text-brand"
                                    : "hover:bg-brand-quiet text-foreground",
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <FileText
                                    className="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">{file.name}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                                    {file.type === "GOOGLE_DOC" ? "Doc" : "PDF"}
                                  </span>
                                  {isSelected && (
                                    <Check className="size-3.5 text-brand" aria-hidden="true" />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                          {driveFilesQuery.hasNextPage && (
                            <div className="border-t border-border p-2 text-center">
                              <button
                                type="button"
                                onClick={() => void driveFilesQuery.fetchNextPage()}
                                disabled={driveFilesQuery.isFetchingNextPage}
                                className="cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-medium text-brand transition-colors hover:bg-brand-quiet disabled:opacity-50 motion-reduce:transition-none"
                              >
                                {driveFilesQuery.isFetchingNextPage
                                  ? "Loading more…"
                                  : "Load more files"}
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          {debouncedDriveSearch
                            ? `No Google Docs or PDFs match “${debouncedDriveSearch}”.`
                            : "No Google Docs or PDFs were found in your Drive."}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
            </IntegrationStatusGate>
          )}

          {/* 3. Notion */}
          {activeTab === "notion" && (
            <IntegrationStatusGate
              label="Notion"
              isLoading={isLoadingIntegrations}
              isError={isIntegrationsError}
              error={integrationsError}
              onRetry={() => void refetchIntegrations()}
            >
              <div className="space-y-4">
              {!integrations?.notion?.connected ? (
                <div className="relative space-y-4 rounded-2xl border border-border bg-brand-quiet p-6">
                  {/* Corner Help Button */}
                  <button
                    type="button"
                    onClick={() => setShowNotionHelp(true)}
                    aria-label="How to get a Notion token?"
                    className="absolute right-3.5 top-3.5 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand motion-reduce:transition-none"
                    title="How to get a Notion token?"
                  >
                    <HelpCircle className="size-4" aria-hidden="true" />
                  </button>

                  <div className="space-y-1 text-center">
                    <NotionIcon size={36} className="mx-auto" />
                    <h3 className="kairos-section-title text-sm text-primary">
                      Connect your Notion workspace
                    </h3>
                    <p className="mx-auto max-w-sm text-[11px] text-muted-foreground">
                      Paste your Notion internal integration token to browse and import your pages.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <input
                      id="notion-token"
                      type="password"
                      aria-label="Notion internal integration token"
                      placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={notionTokenInput}
                      onChange={(e) => setNotionTokenInput(e.target.value)}
                      className={cn(FORM_CONTROL_CLASSNAME, "font-mono")}
                    />
                    <button
                      type="button"
                      onClick={handleConnectNotionToken}
                      disabled={isConnectingNotion}
                      className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 disabled:opacity-50 motion-reduce:transition-none"
                    >
                      {isConnectingNotion ? <ThemeLoader size={14} /> : "Connect Notion token"}
                    </button>
                  </div>

                  {/* Notion Token Help Popup Modal */}
                  <NotionTokenGuideModal
                    isOpen={showNotionHelp}
                    onClose={() => setShowNotionHelp(false)}
                  />
                </div>
              ) : (


                <div className="space-y-3">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      aria-label="Search Notion pages"
                      placeholder="Search Notion pages..."
                      value={notionSearch}
                      onChange={(e) => setNotionSearch(e.target.value)}
                      className={cn(FORM_CONTROL_CLASSNAME, "pl-8 pr-3")}
                    />
                  </div>


                  {isNotionPagesError ? (
                    <div role="alert" className="kairos-inset space-y-2 p-4 text-center">
                      <AlertCircle className="mx-auto size-5 text-danger" aria-hidden="true" />
                      <p className="text-xs font-medium text-foreground">
                        Couldn&apos;t load Notion pages.
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {getErrorMessage(notionPagesError, "The provider rejected the request.")}
                      </p>
                      <button
                        type="button"
                        onClick={() => void refetchNotionPages()}
                        className="mx-auto flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none"
                      >
                        <RefreshCw className="size-3" aria-hidden="true" />
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div
                      role="listbox"
                      aria-label="Notion pages"
                      className="kairos-inset max-h-52 divide-y divide-border overflow-y-auto"
                    >
                      {isLoadingNotionPages ? (
                        <div className="p-6 text-center" role="status">
                          <ThemeLoader size={20} />
                        </div>
                      ) : notionPagesData?.pages && notionPagesData.pages.length > 0 ? (
                        notionPagesData.pages.map((page) => {
                          const isSelected = selectedNotionPageId === page.id;
                          return (
                            <button
                              key={page.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => setSelectedNotionPageId(page.id)}
                              className={cn(
                                "flex w-full cursor-pointer items-center justify-between gap-3 p-2.5 text-left text-xs transition-colors motion-reduce:transition-none",
                                isSelected
                                  ? "bg-brand-soft font-semibold text-brand"
                                  : "hover:bg-brand-quiet text-foreground"
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-sm">{page.icon || "📄"}</span>
                                <span className="truncate">{page.title}</span>
                              </span>
                              {isSelected && (
                                <Check className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          No accessible Notion pages found. Please ensure your integration is invited to the pages.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
            </IntegrationStatusGate>
          )}

          {/* 4. Website URL */}
          {activeTab === "website" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="website-url" className="mb-1 block text-xs font-medium text-foreground">
                  Website URL
                </label>
                <input
                  id="website-url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>

              <div>
                <label htmlFor="website-title" className="mb-1 block text-xs font-medium text-foreground">
                  Title (Optional)
                </label>
                <input
                  id="website-title"
                  type="text"
                  placeholder="Custom title"
                  value={webTitle}
                  onChange={(e) => setWebTitle(e.target.value)}
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>
            </div>
          )}

          {/* 5. YouTube URL */}
          {activeTab === "youtube" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="youtube-url" className="mb-1 block text-xs font-medium text-foreground">
                  YouTube Video URL
                </label>
                <input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>

              <div>
                <label htmlFor="youtube-title" className="mb-1 block text-xs font-medium text-foreground">
                  Title (Optional)
                </label>
                <input
                  id="youtube-title"
                  type="text"
                  placeholder="Custom video title"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>
            </div>
          )}

          {/* 6. Raw Text */}
          {activeTab === "text" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="text-title" className="mb-1 block text-xs font-medium text-foreground">
                  Title
                </label>
                <input
                  id="text-title"
                  type="text"
                  placeholder="e.g. Chapter 1 Notes"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>

              <div>
                <label htmlFor="text-content" className="mb-1 block text-xs font-medium text-foreground">
                  Content
                </label>
                <textarea
                  id="text-content"
                  rows={6}
                  placeholder="Paste your text content here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className={cn(FORM_CONTROL_CLASSNAME, "font-mono")}
                />
              </div>
            </div>
          )}

          {/* 7. GitHub Repository */}
          {activeTab === "github" && (
            <IntegrationStatusGate
              label="GitHub"
              isLoading={isLoadingIntegrations}
              isError={isIntegrationsError}
              error={integrationsError}
              onRetry={() => void refetchIntegrations()}
            >
              <div className="space-y-4">
              {/* Not Connected State */}
              {!integrations?.github?.connected ? (
                <>
                  <div className="space-y-3 rounded-xl border border-border bg-brand-quiet p-4">
                    <div className="flex items-start gap-3">
                      <GithubIcon size={20} className="mt-0.5 shrink-0 text-brand" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-primary">
                          Connect GitHub to browse your repositories
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Connect your GitHub account to list and import both public and private repositories without rate limits.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectGithub}
                      className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 motion-reduce:transition-none"
                    >
                      Connect GitHub
                    </button>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="grow border-t border-border"></div>
                    <span className="shrink mx-3 text-[10px] text-muted-foreground uppercase font-mono">
                      Or enter public repo URL
                    </span>
                    <div className="grow border-t border-border"></div>
                  </div>

                  <div>
                    <label htmlFor="github-url-public" className="mb-1 block text-xs font-medium text-foreground">
                      GitHub Repository URL
                    </label>
                    <input
                      id="github-url-public"
                      type="url"
                      placeholder="https://github.com/owner/repo"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className={FORM_CONTROL_CLASSNAME}
                    />
                  </div>

                  <div>
                    <label htmlFor="github-title-public" className="mb-1 block text-xs font-medium text-foreground">
                      Title (Optional)
                    </label>
                    <input
                      id="github-title-public"
                      type="text"
                      placeholder="e.g. My Project Docs"
                      value={githubTitle}
                      onChange={(e) => setGithubTitle(e.target.value)}
                      className={FORM_CONTROL_CLASSNAME}
                    />
                  </div>
                </>
              ) : (
                /* Connected State: List user's repositories */
                <div className="space-y-3">
                  {/* Account Badge & Switch Mode */}
                  <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-brand-quiet px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-success" aria-hidden="true" />
                      <span>
                        Connected as{" "}
                        <span className="font-semibold text-primary">
                          {integrations.github.account?.metadata?.login || "GitHub User"}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void githubReposQuery.refetch()}
                        aria-label="Refresh repositories"
                        title="Refresh repositories"
                        className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand motion-reduce:transition-none"
                      >
                        <RefreshCw
                          className={cn(
                            "size-3.5",
                            githubReposQuery.isFetching &&
                              "animate-spin motion-reduce:animate-none"
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualGithubUrl(!isManualGithubUrl);
                          setSelectedGithubRepoUrl(null);
                        }}
                        className="cursor-pointer text-[11px] font-medium text-brand hover:underline"
                      >
                        {isManualGithubUrl ? "Browse my repos" : "Enter custom URL"}
                      </button>
                    </div>
                  </div>

                  {isManualGithubUrl ? (
                    /* Manual Custom URL input when connected */
                    <div className="space-y-3 pt-1">
                      <div>
                        <label htmlFor="github-url-manual" className="mb-1 block text-xs font-medium text-foreground">
                          GitHub Repository URL
                        </label>
                        <input
                          id="github-url-manual"
                          type="url"
                          placeholder="https://github.com/owner/repo"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          className={FORM_CONTROL_CLASSNAME}
                        />
                      </div>

                      <div>
                        <label htmlFor="github-title-manual" className="mb-1 block text-xs font-medium text-foreground">
                          Title (Optional)
                        </label>
                        <input
                          id="github-title-manual"
                          type="text"
                          placeholder="e.g. My Project Docs"
                          value={githubTitle}
                          onChange={(e) => setGithubTitle(e.target.value)}
                          className={FORM_CONTROL_CLASSNAME}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Repository List from GitHub */
                    <div className="space-y-3">
                      <div className="relative">
                        <Search
                      className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                        <input
                          type="text"
                          aria-label="Search GitHub repositories"
                          placeholder="Search your repositories..."
                          value={githubSearch}
                          onChange={(e) => {
                            setGithubSearch(e.target.value);
                            setSelectedGithubRepoUrl(null);
                          }}
                          className={cn(FORM_CONTROL_CLASSNAME, "pl-8 pr-3")}
                        />
                      </div>

                      {githubReposQuery.isFetching && !githubReposQuery.isLoading && (
                        <p role="status" className="text-[11px] text-muted-foreground">
                          Updating repositories…
                        </p>
                      )}

                      {githubReposQuery.isError ? (
                        <div role="alert" className="kairos-inset space-y-2 p-4 text-center">
                          <AlertCircle className="mx-auto size-5 text-danger" aria-hidden="true" />
                          <p className="text-xs font-medium text-foreground">
                            Couldn&apos;t load GitHub repositories.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {getErrorMessage(
                              githubReposQuery.error,
                              "The provider rejected the request.",
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => void githubReposQuery.refetch()}
                            className="mx-auto flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none"
                          >
                            <RefreshCw className="size-3" aria-hidden="true" />
                            Retry
                          </button>
                        </div>
                      ) : (
                        <div
                          role="listbox"
                          aria-label="GitHub repositories"
                          className="kairos-inset max-h-56 overflow-y-auto"
                        >
                          {githubReposQuery.isLoading ? (
                            <div className="space-y-2 p-6 text-center" role="status">
                              <ThemeLoader size={20} />
                              <p className="text-xs text-muted-foreground">
                                Loading your repositories...
                              </p>
                            </div>
                          ) : githubRepos.length > 0 ? (
                            <>
                              {githubRepos.map((repo) => {
                                const isSelected =
                                  (selectedGithubRepoUrl || githubUrl) === repo.htmlUrl;
                                return (
                                  <button
                                    key={repo.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                      setSelectedGithubRepoUrl(repo.htmlUrl);
                                      setGithubUrl(repo.htmlUrl);
                                      if (!githubTitle) {
                                        setGithubTitle(repo.name);
                                      }
                                    }}
                                    className={cn(
                                      "flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border p-2.5 text-left text-xs transition-colors last:border-b-0 motion-reduce:transition-none",
                                      isSelected
                                        ? "bg-brand-soft font-medium text-brand"
                                        : "hover:bg-brand-quiet text-foreground",
                                    )}
                                  >
                                    <span className="flex min-w-0 items-start gap-2.5">
                                      <span className="mt-0.5 shrink-0 text-muted-foreground">
                                        {repo.isPrivate ? (
                                          <Lock
                                            className="size-3.5 text-warning"
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <GitFork
                                            className="size-3.5 text-muted-foreground"
                                            aria-hidden="true"
                                          />
                                        )}
                                      </span>
                                      <span className="min-w-0 space-y-0.5">
                                        <span className="flex flex-wrap items-center gap-2">
                                          <span className="truncate font-semibold">
                                            {repo.fullName}
                                          </span>
                                          <span
                                            className={cn(
                                              "rounded border px-1.5 py-0.2 font-mono text-[9px]",
                                              repo.isPrivate
                                                ? "border-warning/30 bg-warning/10 text-warning"
                                                : "border-border bg-muted/50 text-muted-foreground",
                                            )}
                                          >
                                            {repo.isPrivate ? "Private" : "Public"}
                                          </span>
                                          {repo.language && (
                                            <span className="font-mono text-[10px] text-muted-foreground">
                                              {repo.language}
                                            </span>
                                          )}
                                        </span>
                                        {repo.description && (
                                          <span className="line-clamp-1 text-[11px] text-muted-foreground">
                                            {repo.description}
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2">
                                      {repo.stargazersCount > 0 && (
                                        <span className="flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground">
                                          <Star className="size-2.5 fill-warning text-warning" />
                                          {repo.stargazersCount}
                                        </span>
                                      )}
                                      {isSelected && (
                                        <Check className="size-4 text-success" aria-hidden="true" />
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                              {githubReposQuery.hasNextPage && (
                                <div className="border-t border-border p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => void githubReposQuery.fetchNextPage()}
                                    disabled={githubReposQuery.isFetchingNextPage}
                                    className="cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-medium text-brand transition-colors hover:bg-brand-quiet disabled:opacity-50 motion-reduce:transition-none"
                                  >
                                    {githubReposQuery.isFetchingNextPage
                                      ? "Loading more…"
                                      : "Load more repositories"}
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-1 p-6 text-center text-xs text-muted-foreground">
                              <p className="font-medium text-foreground">No repositories found</p>
                              <p className="text-[11px]">
                                {debouncedGithubSearch
                                  ? `No repos match “${debouncedGithubSearch}”.`
                                  : "No repositories were found in your GitHub account."}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Title input when a repo is selected */}
                      <div>
                        <label htmlFor="github-repo-title" className="mb-1 block text-xs font-medium text-foreground">
                          Source Title (Optional)
                        </label>
                        <input
                          id="github-repo-title"
                          type="text"
                          placeholder="e.g. My Project Docs"
                          value={githubTitle}
                          onChange={(e) => setGithubTitle(e.target.value)}
                          className={FORM_CONTROL_CLASSNAME}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                We&apos;ll index up to 150 text files (code, docs, configs) from the repository and make them searchable in chat.
              </p>
              </div>
            </IntegrationStatusGate>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="cursor-pointer rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-quiet hover:text-brand motion-reduce:transition-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                (activeTab === "google-drive" && !selectedDriveFileId) ||
                (activeTab === "notion" && !selectedNotionPageId) ||
                (activeTab === "github" && !githubUrl.trim())
              }
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 disabled:opacity-50 motion-reduce:transition-none"
            >
              {isLoading ? (
                <>
                  <ThemeLoader size={14} />
                  <span>Importing source...</span>
                </>
              ) : (
                <span>Add source</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
