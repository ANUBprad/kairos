import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function validateApiKey(request: NextRequest): boolean {
  return !!request.headers.get("x-api-key");
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const body = await request.json();
  const { experimentAId, experimentBId } = body;

  if (!experimentAId || !experimentBId) {
    return NextResponse.json({ error: "experimentAId and experimentBId are required" }, { status: 400 });
  }

  const [expA, expB] = await Promise.all([
    prisma.experiment.findUnique({ where: { id: experimentAId } }),
    prisma.experiment.findUnique({ where: { id: experimentBId } }),
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
}
