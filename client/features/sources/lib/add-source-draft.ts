/**
 * Session-scoped draft for the Add Knowledge dialog.
 *
 * Only non-secret, serializable form values are stored. File objects and the
 * Notion integration token are deliberately excluded; session storage keeps a
 * draft recoverable across an OAuth redirect without persisting credentials.
 */

export type AddSourceTab =
  | "pdf"
  | "image"
  | "website"
  | "youtube"
  | "text"
  | "google-drive"
  | "notion"
  | "github";

const TABS = new Set<AddSourceTab>([
  "pdf",
  "image",
  "website",
  "youtube",
  "text",
  "google-drive",
  "notion",
  "github",
]);

export interface AddSourceDraft {
  activeTab: AddSourceTab;
  pdfTitle: string;
  imageTitle: string;
  webUrl: string;
  webTitle: string;
  youtubeUrl: string;
  youtubeTitle: string;
  textTitle: string;
  textContent: string;
  driveSearch: string;
  selectedDriveFileId: string | null;
  notionSearch: string;
  selectedNotionPageId: string | null;
  githubUrl: string;
  githubTitle: string;
  githubSearch: string;
  selectedGithubRepoUrl: string | null;
  isManualGithubUrl: boolean;
}

export const EMPTY_ADD_SOURCE_DRAFT: AddSourceDraft = Object.freeze({
  activeTab: "pdf",
  pdfTitle: "",
  imageTitle: "",
  webUrl: "",
  webTitle: "",
  youtubeUrl: "",
  youtubeTitle: "",
  textTitle: "",
  textContent: "",
  driveSearch: "",
  selectedDriveFileId: null,
  notionSearch: "",
  selectedNotionPageId: null,
  githubUrl: "",
  githubTitle: "",
  githubSearch: "",
  selectedGithubRepoUrl: null,
  isManualGithubUrl: false,
});

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStorageOrNull(): DraftStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Keeps a route-provided workspace id from becoming an unexpected storage key. */
function safeWorkspaceId(workspaceId?: string): string {
  if (!workspaceId || !/^[A-Za-z0-9_-]{1,120}$/.test(workspaceId)) {
    return "global";
  }
  return workspaceId;
}

export function addSourceDraftKey(workspaceId?: string): string {
  return `kairos_add_source_draft_${safeWorkspaceId(workspaceId)}`;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function nullableText(value: unknown, max: number): string | null {
  const normalized = text(value, max);
  return normalized || null;
}

/** Reads a draft defensively; malformed or oversized values fall back to empty. */
export function readAddSourceDraft(
  workspaceId?: string,
  storage: DraftStorage | null = sessionStorageOrNull(),
): AddSourceDraft {
  if (!storage) return { ...EMPTY_ADD_SOURCE_DRAFT };
  try {
    const raw = storage.getItem(addSourceDraftKey(workspaceId));
    if (!raw) return { ...EMPTY_ADD_SOURCE_DRAFT };
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || parsed.version !== 1) return { ...EMPTY_ADD_SOURCE_DRAFT };

    const activeTab = parsed.activeTab as AddSourceTab;
    return {
      activeTab: TABS.has(activeTab) ? activeTab : EMPTY_ADD_SOURCE_DRAFT.activeTab,
      pdfTitle: text(parsed.pdfTitle, 300),
      imageTitle: text(parsed.imageTitle, 300),
      webUrl: text(parsed.webUrl, 2000),
      webTitle: text(parsed.webTitle, 300),
      youtubeUrl: text(parsed.youtubeUrl, 2000),
      youtubeTitle: text(parsed.youtubeTitle, 300),
      textTitle: text(parsed.textTitle, 300),
      textContent: text(parsed.textContent, 50_000),
      driveSearch: text(parsed.driveSearch, 300),
      selectedDriveFileId: nullableText(parsed.selectedDriveFileId, 300),
      notionSearch: text(parsed.notionSearch, 300),
      selectedNotionPageId: nullableText(parsed.selectedNotionPageId, 300),
      githubUrl: text(parsed.githubUrl, 2000),
      githubTitle: text(parsed.githubTitle, 300),
      githubSearch: text(parsed.githubSearch, 300),
      selectedGithubRepoUrl: nullableText(parsed.selectedGithubRepoUrl, 2000),
      isManualGithubUrl: parsed.isManualGithubUrl === true,
    };
  } catch {
    return { ...EMPTY_ADD_SOURCE_DRAFT };
  }
}

export function hasDraftContent(draft: AddSourceDraft): boolean {
  return (
    draft.activeTab !== EMPTY_ADD_SOURCE_DRAFT.activeTab ||
    draft.pdfTitle.length > 0 ||
    draft.imageTitle.length > 0 ||
    draft.webUrl.length > 0 ||
    draft.webTitle.length > 0 ||
    draft.youtubeUrl.length > 0 ||
    draft.youtubeTitle.length > 0 ||
    draft.textTitle.length > 0 ||
    draft.textContent.length > 0 ||
    draft.driveSearch.length > 0 ||
    draft.selectedDriveFileId !== null ||
    draft.notionSearch.length > 0 ||
    draft.selectedNotionPageId !== null ||
    draft.githubUrl.length > 0 ||
    draft.githubTitle.length > 0 ||
    draft.githubSearch.length > 0 ||
    draft.selectedGithubRepoUrl !== null ||
    draft.isManualGithubUrl
  );
}

export function writeAddSourceDraft(
  workspaceId: string | undefined,
  draft: AddSourceDraft,
  storage: DraftStorage | null = sessionStorageOrNull(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      addSourceDraftKey(workspaceId),
      JSON.stringify({ version: 1, ...draft }),
    );
  } catch {
    // Storage can be unavailable or full; the in-memory form still works.
  }
}

export function clearAddSourceDraft(
  workspaceId?: string,
  storage: DraftStorage | null = sessionStorageOrNull(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(addSourceDraftKey(workspaceId));
  } catch {
    // Clearing is best-effort; a later write overwrites the same key.
  }
}
