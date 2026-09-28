"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let initialized = false;
let analyticsEnabled = true;

function getConsent(): boolean {
  try {
    const stored = localStorage.getItem("kairos_cookie_consent");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.analytics ?? true;
    }
  } catch {
    // Ignore parsing errors
  }
  return true;
}

async function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;
  if (!getConsent()) return;
  const posthog = (await import("posthog-js")).default;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    persistence: "localStorage",
  });
  initialized = true;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  useEffect(() => {
    const consent = getConsent();
    if (!consent) {
      analyticsEnabled = false;
      return;
    }
    analyticsEnabled = true;
    initPostHog();
  }, []);

  useEffect(() => {
    if (!initialized || !analyticsEnabled) return;
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    (async () => {
      const posthog = (await import("posthog-js")).default;
      posthog.capture("$pageview", { path: pathname, url });
    })();
  }, [pathname, searchParams]);

  return children;
}

export async function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized || !POSTHOG_KEY) return;
  const consent = getConsent();
  if (!consent) return;
  const posthog = (await import("posthog-js")).default;
  posthog.capture(event, properties);
}
