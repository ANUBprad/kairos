"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "kairos_cookie_consent";

interface CookieConsentState {
  essential: boolean;
  analytics: boolean;
  timestamp: number;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<CookieConsentState | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CookieConsentState;
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30 * 24 * 60 * 60 * 1000) {
          setConsent(parsed);
          return;
        }
      }
    } catch {
      // Ignore parsing errors
    }
    setVisible(true);
  }, []);

  const accept = useCallback(() => {
    const state: CookieConsentState = {
      essential: true,
      analytics: true,
      timestamp: Date.now(),
    };
    setConsent(state);
    setVisible(false);
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cookie-consent", { detail: state }));
    }
  }, []);

  const reject = useCallback(() => {
    const state: CookieConsentState = {
      essential: true,
      analytics: false,
      timestamp: Date.now(),
    };
    setConsent(state);
    setVisible(false);
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cookie-consent", { detail: state }));
    }
  }, []);

  if (!visible || !consent) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-border"
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="true"
    >
      <div className="mx-auto max-w-[1280px] px-6 sm:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 space-y-2">
            <p className="text-[14px] font-semibold text-text-primary">
              Cookie Preferences
            </p>
            <p className="text-[13px] text-text-secondary leading-relaxed max-w-lg">
              We use essential cookies for authentication and session management.
              Analytics cookies help us understand how visitors use the platform.
              You can choose which cookies to allow.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={reject}>
              Reject Analytics
            </Button>
            <Button variant="primary" size="sm" onClick={accept}>
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}