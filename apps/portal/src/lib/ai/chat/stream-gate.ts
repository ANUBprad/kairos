export interface StreamGateResult {
  streaming: boolean;
  error: string | null;
}

const GENERIC_ERROR = "Request failed";

// Reduced contract check for /api/ai/chat responses: a healthy turn is a 200
// `text/event-stream`. Anything else fails fast before an SSE reader is
// allocated: 4xx/5xx statuses surface the server-controlled `{ error }` message
// (never internal details), a 200 that is not SSE gets a generic response, and
// a non-JSON error body falls back to the generic message too.
export async function resolveStreamGate(response: Response): Promise<StreamGateResult> {
  if (response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      return { streaming: true, error: null };
    }
    return { streaming: false, error: "Unexpected server response" };
  }

  let error = GENERIC_ERROR;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body?.error === "string" && body.error.trim().length > 0) {
      error = body.error.trim();
    }
  } catch {
    // non-JSON error body; keep the generic message
  }
  return { streaming: false, error };
}