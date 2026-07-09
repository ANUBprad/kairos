import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { runCopilot } from "@/lib/copilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { query, benchmarkRuns } = body;

  if (!query || typeof query !== "string") {
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

  try {
    const result = await runCopilot({
      request: { query },
      benchmarkRuns: benchmarkRuns || [],
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
    console.error("Copilot error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
