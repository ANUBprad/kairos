import { NextRequest, NextResponse } from "next/server";
import { runCopilot } from "@/lib/copilot";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rl = rateLimit(`copilot:demo-user`, RATE_LIMITS.copilot);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.copilot) },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const benchmarkRuns = Array.isArray(body.benchmarkRuns) ? body.benchmarkRuns : [];

  if (!query) {
    return NextResponse.json(
      { error: "Missing required field: query" },
      { status: 400 }
    );
  }

  if (query.length > 10000) {
    return NextResponse.json(
      { error: "Query is too long" },
      { status: 400 }
    );
  }

  if (benchmarkRuns.length > 50) {
    return NextResponse.json(
      { error: "Too many benchmark runs" },
      { status: 400 }
    );
  }

  try {
    const result = await runCopilot({
      request: { query },
      benchmarkRuns,
    });

    return NextResponse.json({
      answer: result.response.answer,
      intent: result.response.intent,
      confidence: result.response.confidence,
      evidence: result.response.evidence,
      relatedExperiments: result.response.relatedExperiments,
      relatedBenchmarks: result.response.relatedBenchmarks,
      suggestedFollowUp: result.response.suggestedFollowUp,
      grounding: result.grounding,
      suggestions: result.suggestions.map((s) => s.question),
      dailyBrief: result.dailyBrief,
    });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: "Failed to process request", errorId: sanitized.errorId },
      { status: 500 }
    );
  }
}
