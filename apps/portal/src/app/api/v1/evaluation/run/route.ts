import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTELLIGENCE_URL = (process.env.INTELLIGENCE_REST_URL ?? "http://localhost:8000").replace(/\/$/, "");
const API_SECRET = process.env.KAIROS_API_SECRET ?? "";
const MAX_ENTRIES = 1000;
const MAX_DATASET_LENGTH = 255;
const MAX_NAMESPACE_LENGTH = 255;

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`eval-run:${session.user.id}`, RATE_LIMITS.api);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.api) },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const namespace = typeof body.namespace === "string" ? body.namespace.trim() : "";
  const datasetName = typeof body.dataset_name === "string" ? body.dataset_name.trim() : "";
  const datasetPath = typeof body.dataset_path === "string" ? body.dataset_path.trim() : "";

  if (!namespace || !datasetName) {
    return NextResponse.json(
      { error: "namespace and dataset_name are required" },
      { status: 400 },
    );
  }
  if (namespace.length > MAX_NAMESPACE_LENGTH || datasetName.length > MAX_DATASET_LENGTH) {
    return NextResponse.json({ error: "namespace or dataset_name too long" }, { status: 400 });
  }

  const maxEntries = typeof body.max_entries === "number" && Number.isFinite(body.max_entries)
    ? Math.min(Math.max(Math.trunc(body.max_entries), 1), MAX_ENTRIES)
    : undefined;
  const topK = typeof body.top_k === "number" && Number.isFinite(body.top_k)
    ? Math.max(Math.trunc(body.top_k), 1)
    : undefined;

  try {
    const upstream = await fetch(`${INTELLIGENCE_URL}/api/v1/evaluation/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(API_SECRET ? { "x-api-key": API_SECRET } : {}),
      },
      body: JSON.stringify({
        namespace,
        dataset_name: datasetName,
        ...(datasetPath ? { dataset_path: datasetPath } : {}),
        ...(topK !== undefined ? { top_k: topK } : {}),
        ...(maxEntries !== undefined ? { max_entries: maxEntries } : {}),
        ...(typeof body.generate === "boolean" ? { generate: body.generate } : {}),
        ...(typeof body.judge === "boolean" ? { judge: body.judge } : {}),
        ...(typeof body.use_llm_judges === "boolean" ? { use_llm_judges: body.use_llm_judges } : {}),
      }),
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });

    const payload: unknown = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const detail =
        payload &&
        typeof payload === "object" &&
        "detail" in payload
          ? String((payload as { detail: unknown }).detail)
          : `Evaluation API error (${upstream.status})`;
      return NextResponse.json(
        { error: detail },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: "Failed to reach evaluation API", errorId: sanitized.errorId },
      { status: 504 },
    );
  }
}