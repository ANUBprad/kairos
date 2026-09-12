"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLearningArtifactForWorkspace } from "@/lib/actions/artifacts";
import type { LearningArtifactData } from "@/lib/artifacts/types";
import { SummaryArtifactViewer } from "./summary-artifact-viewer";

interface Props {
  kbId: string;
  artifactId: string | null;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

// Opens an artifact by fetching it through the O4-T3 workspace action. The id
// from the browser is never trusted directly — the action re-checks the KB
// tenant boundary before returning anything.
export function SummaryArtifactDialog({ kbId, artifactId, sources, onClose }: Props) {
  const [artifact, setArtifact] = useState<LearningArtifactData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artifactId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArtifact(null);

    getLearningArtifactForWorkspace(kbId, artifactId)
      .then((data) => {
        if (cancelled) return;
        setArtifact(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load summary");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kbId, artifactId]);

  if (!artifactId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Summary artifact"
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
      >
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : artifact ? (
          <div className="overflow-y-auto">
            <SummaryArtifactViewer artifact={artifact} sources={sources} onClose={onClose} />
          </div>
        ) : (
          <div className="flex items-center justify-center py-24">
            <FileText size={24} className="text-text-tertiary" />
          </div>
        )}
      </div>
    </div>
  );
}