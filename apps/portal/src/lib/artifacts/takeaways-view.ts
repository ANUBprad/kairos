import { takeawaysArtifactSchema } from "./takeaways";

// Typed window into a stored TAKEAWAYS payload. The O4-T6 schema is the single
// source of truth; this only guards rendering against malformed or legacy
// content so the viewer never crashes on stored data.
export interface TakeawaysViewContent {
  title: string;
  takeaways: { heading: string; detail: string }[];
}

export function parseTakeawaysContent(content: unknown): TakeawaysViewContent | null {
  const parsed = takeawaysArtifactSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}