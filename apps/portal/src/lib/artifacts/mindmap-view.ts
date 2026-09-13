import { mindmapArtifactSchema, type MindMapNodeData } from "./mindmap";

// Typed window into a stored MINDMAP payload. The O4-T6 schema is the single
// source of truth; this only guards rendering against malformed or legacy
// content so the viewer never crashes on stored data.
export interface MindMapViewContent {
  title: string;
  root: MindMapNodeData;
}

export function parseMindmapContent(content: unknown): MindMapViewContent | null {
  const parsed = mindmapArtifactSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}