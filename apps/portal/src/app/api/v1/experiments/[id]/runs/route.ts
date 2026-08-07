import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const rl = rateLimit(`v1:${auth.organizationId}`, RATE_LIMITS.api);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.api) },
    );
  }

  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const experiment = await prisma.experiment.findFirst({
      where: { id, knowledgeBase: { project: { organizationId: auth.organizationId } } },
      select: { id: true },
    });
    if (!experiment) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

    const runs = await prisma.experimentRun.findMany({
      where: { experimentId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ runs, total: runs.length });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

