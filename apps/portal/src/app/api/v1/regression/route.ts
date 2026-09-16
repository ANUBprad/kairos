import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { validateApiKey } from "@/lib/server/api-auth";
import { trackRegressionComparison } from "@/lib/evaluation/regression-tracking";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const rl = rateLimit(`v1:${auth.organizationId}`, RATE_LIMITS.api);
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

  const baselineRunId = typeof body.baselineRunId === "string" ? body.baselineRunId.trim() : "";
  const candidateRunId = typeof body.candidateRunId === "string" ? body.candidateRunId.trim() : "";

  if (!baselineRunId || !candidateRunId) {
    return NextResponse.json({ error: "baselineRunId and candidateRunId are required" }, { status: 400 });
  }

  if (!UUID_REGEX.test(baselineRunId) || !UUID_REGEX.test(candidateRunId)) {
    return NextResponse.json({ error: "Invalid run ID format" }, { status: 400 });
  }

  try {
    const { record, machine } = await trackRegressionComparison(
      { baselineRunId, candidateRunId },
      auth.organizationId,
    );
    return NextResponse.json({ ...record, result: machine });
  } catch (error) {
    if (error instanceof Error && error.message === "Run not found") {
      return NextResponse.json({ error: "One or both runs not found" }, { status: 404 });
    }
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}