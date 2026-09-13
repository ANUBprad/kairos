import { reportArtifactSchema } from "./report";

// Typed window into a stored REPORT payload. The O4-T5 schema is the single
// source of truth; this only guards rendering against malformed or legacy
// content so the viewer never crashes on stored data.
export interface ReportViewContent {
  title: string;
  executiveSummary: string;
  sections: { heading: string; content: string }[];
  keyFindings: string[];
}

export function parseReportContent(content: unknown): ReportViewContent | null {
  const parsed = reportArtifactSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}