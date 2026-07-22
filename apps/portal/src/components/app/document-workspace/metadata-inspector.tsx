"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Braces,
  Pencil,
  Save,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { DocumentMetadata } from "./types";

interface MetadataInspectorProps {
  metadata: DocumentMetadata | null;
  onUpdate?: (metadata: DocumentMetadata) => Promise<void>;
  className?: string;
}

export function MetadataInspector({ metadata, onUpdate, className }: MetadataInspectorProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEdit = () => {
    setEditValue(JSON.stringify(metadata || {}, null, 2));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    try {
      setSaving(true);
      const parsed = JSON.parse(editValue);
      await onUpdate(parsed);
      setEditing(false);
    } catch {
      // invalid JSON
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(metadata || {}, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <Braces size={24} className="mx-auto text-text-tertiary mb-2" />
        <p className="text-sm text-text-tertiary">No metadata available</p>
        <p className="text-xs text-text-tertiary mt-1">Metadata is extracted during document processing</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          {Object.keys(metadata).length} field{Object.keys(metadata).length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-hover transition-colors"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {onUpdate && !editing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-hover transition-colors"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg p-3 text-xs font-mono text-text-primary focus:border-brand focus:outline-none min-h-[200px]"
            aria-label="Edit metadata JSON"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <Save size={12} />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-4 px-3 py-2.5">
              <span className="text-xs font-medium text-text-tertiary shrink-0">{key}</span>
              <span className="text-xs font-mono text-text-primary text-right break-all">
                {value === null ? (
                  <span className="text-text-tertiary italic">null</span>
                ) : typeof value === "object" ? (
                  <pre className="whitespace-pre-wrap text-[11px]">{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  String(value)
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
