import { z } from "zod";

export const connectNotionSchema = z.object({
    token: z.string().min(1, "Notion token is required"),
});

// Provider IDs are opaque tokens that appear in URL paths. Restricting the
// alphabet to what Google Drive / Notion actually issue prevents path or query
// injection even before encodeURIComponent is applied at the call site.
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,200}$/;

export const importDriveFileSchema = z.object({
    fileId: z.string().trim().regex(PROVIDER_ID, "Invalid Google Drive file ID"),
});

export const listDriveFilesQuerySchema = z.object({
    search: z.string().trim().max(200, "Search is too long").optional(),
    // Google page tokens are opaque; bound the length before passing them to the API.
    pageToken: z.string().trim().max(2048, "Invalid page token").optional(),
});

export const importNotionPageSchema = z.object({
    pageId: z.string().trim().regex(PROVIDER_ID, "Invalid Notion page ID"),
});

export const importGithubRepoSchema = z.object({
    url: z.string().trim().min(1, "GitHub repository URL is required"),
    title: z.string().trim().max(200).optional(),
});

export const listGithubReposQuerySchema = z.object({
    search: z.string().trim().max(200, "Search is too long").optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const exportNotionSchema = z.object({
    parentPageId: z.string().trim().regex(PROVIDER_ID, "Invalid Notion page ID").optional(),
});

export const integrationProviderParamSchema = z.object({
    provider: z.string().min(1),
});

export type ConnectNotionInput = z.infer<typeof connectNotionSchema>;
export type ImportDriveFileInput = z.infer<typeof importDriveFileSchema>;
export type ListDriveFilesQuery = z.infer<typeof listDriveFilesQuerySchema>;
export type ImportNotionPageInput = z.infer<typeof importNotionPageSchema>;
export type ImportGithubRepoInput = z.infer<typeof importGithubRepoSchema>;
export type ListGithubReposQuery = z.infer<typeof listGithubReposQuerySchema>;
export type ExportNotionInput = z.infer<typeof exportNotionSchema>;
