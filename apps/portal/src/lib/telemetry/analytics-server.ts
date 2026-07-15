import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (_client) return _client;
  _client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
  return _client;
}

export function serverTrackEvent(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string,
) {
  const client = getClient();
  if (!client) return;
  try {
    client.capture({
      event,
      distinctId: distinctId ?? "anonymous",
      properties,
    });
  } catch {
    // Analytics failure should not break application
  }
}
