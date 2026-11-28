"use client";

import React from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { dismissOnBackdropClick } from "@/lib/modal";

interface NotionTokenGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotionTokenGuideModal({
  isOpen,
  onClose,
}: NotionTokenGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 bg-overlay backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => dismissOnBackdropClick(e, onClose)}
    >
      <div className="kairos-panel relative max-h-[calc(100vh-2rem)] w-full max-w-md animate-fadeIn space-y-4 overflow-y-auto p-6 text-foreground shadow-[var(--shadow-lift)] motion-reduce:animate-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-brand" aria-hidden="true" />
            <h3 className="kairos-section-title text-sm text-primary">
              How to get your Notion token
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Notion token guide"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-brand-quiet hover:text-brand motion-reduce:transition-none"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3 text-xs">
          {/* Step 1 */}
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              1
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-primary">
                Create an Integration
              </p>
              <p className="text-[11px] text-muted-foreground">
                Go to{" "}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-brand underline underline-offset-4 hover:text-primary"
                >
                  notion.so/my-integrations
                  <ExternalLink className="size-2.5" aria-hidden="true" />
                </a>{" "}
                and click <strong>&quot;+ New integration&quot;</strong>. Name it <em>Kairos</em>.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              2
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-primary">
                Connect Notion Pages
              </p>
              <p className="text-[11px] text-muted-foreground">
                In Notion, open any page you want to access, click the top-right <strong>···</strong> menu ➔ <strong>Connections</strong> ➔ select <em>Kairos</em>.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              3
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-primary">
                Copy Secret Token
              </p>
              <p className="text-[11px] text-muted-foreground">
                Under <strong>Secrets</strong>, copy the <strong>Internal Integration Secret</strong> (starts with <code className="rounded bg-brand-quiet px-1 py-0.5 font-mono text-[10px] text-brand">secret_...</code>) and paste it into Kairos.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border pt-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 motion-reduce:transition-none"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
