"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Globe, Youtube, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ingestUrl, ingestYouTube } from "@/lib/actions/document";

type Mode = "url" | "youtube";

const MODES: { key: Mode; label: string; icon: typeof Globe; placeholder: string }[] = [
  { key: "url", label: "URL", icon: Globe, placeholder: "https://example.com/article" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://www.youtube.com/watch?v=..." },
];

interface Props {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFileUpload: () => void;
}

export function SourceAddDialog({ kbId, open, onOpenChange, onOpenFileUpload }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const active = MODES.find((m) => m.key === mode);

  const handleSubmit = async () => {
    const value = url.trim();
    if (!value) {
      toast.error("Please enter a URL");
      return;
    }
    setIsLoading(true);
    try {
      if (mode === "youtube") {
        await ingestYouTube(kbId, value);
        toast.success("YouTube transcript added");
      } else {
        await ingestUrl(kbId, value);
        toast.success("URL added");
      }
      setUrl("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-add-title"
        aria-describedby="source-add-description"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="source-add-title" className="text-lg font-semibold text-text-primary">Add a source</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-text-tertiary transition-colors hover:text-text-primary"
            disabled={isLoading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p id="source-add-description" className="sr-only">Add a URL or YouTube video as a knowledge base source.</p>

        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors",
                mode === m.key
                  ? "border-brand/30 bg-brand/10 text-brand"
                  : "border-border text-text-secondary hover:bg-surface-hover",
              )}
            >
              <m.icon size={15} />
              {m.label}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={active?.placeholder}
          aria-label={active?.label + " URL"}
          disabled={isLoading}
          className="mt-4 w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        />

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => {
              onOpenChange(false);
              onOpenFileUpload();
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-secondary"
          >
            <Upload size={13} />
            Prefer to upload files?
          </button>
          <Button variant="primary" onClick={handleSubmit} disabled={isLoading || !url.trim()}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Adding...
              </span>
            ) : (
              "Add source"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}