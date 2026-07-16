"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let initialized = false;

async function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;
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

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!initialized) return;
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
  const posthog = (await import("posthog-js")).default;
  posthog.capture(event, properties);
}
