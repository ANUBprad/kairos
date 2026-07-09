"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InputDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  isLoading?: boolean;
  confirmLabel?: string;
}

export function InputDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  placeholder = "Enter value...",
  defaultValue = "",
  isLoading = false,
  confirmLabel = "Confirm",
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open, defaultValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, isLoading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(value);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isLoading && onClose()}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="input-dialog-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="input-dialog-title" className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
            disabled={isLoading}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {description && (
          <p className="text-sm text-text-secondary mb-4">{description}</p>
        )}

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
          />

          <div className="flex gap-3 pt-5">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isLoading || !value.trim()}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </span>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
