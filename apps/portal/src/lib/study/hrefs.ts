// Canonical routes for the Study Dashboard. Both reference existing app routes
// (the artifact detail page and this study page); the dashboard never fabricates
// its own destinations.
export function studyArtifactHref(kbId: string, artifactId: string): string {
  return `/app/knowledge-bases/${kbId}/artifacts/${artifactId}`;
}

export function studyDashboardHref(kbId: string): string {
  return `/app/knowledge-bases/${kbId}/study`;
}