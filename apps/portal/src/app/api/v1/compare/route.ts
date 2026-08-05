import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

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

  const experimentAId = typeof body.experimentAId === "string" ? body.experimentAId.trim() : "";
  const experimentBId = typeof body.experimentBId === "string" ? body.experimentBId.trim() : "";

  if (!experimentAId || !experimentBId) {
    return NextResponse.json({ error: "experimentAId and experimentBId are required" }, { status: 400 });
  }

  if (!UUID_REGEX.test(experimentAId) || !UUID_REGEX.test(experimentBId)) {
    return NextResponse.json({ error: "Invalid experiment ID format" }, { status: 400 });
  }

  try {
    const [expA, expB] = await Promise.all([
      prisma.experiment.findFirst({
        where: { id: experimentAId, knowledgeBase: { project: { organizationId: auth.organizationId } } },
      }),
      prisma.experiment.findFirst({
        where: { id: experimentBId, knowledgeBase: { project: { organizationId: auth.organizationId } } },
      }),
    ]);

    if (!expA || !expB) {
      return NextResponse.json({ error: "One or both experiments not found" }, { status: 404 });
    }

    const [runA, runB] = await Promise.all([
      prisma.experimentRun.findFirst({
        where: { experimentId: experimentAId, status: "completed" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.experimentRun.findFirst({
        where: { experimentId: experimentBId, status: "completed" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const metricsA = (runA?.metrics as Record<string, number>) ?? {};
    const metricsB = (runB?.metrics as Record<string, number>) ?? {};

    const metricKeys = [...new Set([...Object.keys(metricsA), ...Object.keys(metricsB)])];
    const winner = metricKeys.reduce(
      (acc, key) => {
        const a = metricsA[key] ?? 0;
        const b = metricsB[key] ?? 0;
        if (a > b) acc.aWins++;
        else if (b > a) acc.bWins++;
        return acc;
      },
      { aWins: 0, bWins: 0 },
    );

    return NextResponse.json({
      experimentA: expA,
      experimentB: expB,
      runA,
      runB,
      metricsA,
      metricsB,
      winner: winner.aWins > winner.bWins ? "A" : winner.bWins > winner.aWins ? "B" : "tie",
      scoreA: winner.aWins,
      scoreB: winner.bWins,
    });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}


