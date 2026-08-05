import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 255;

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const rl = rateLimit(`v1:${auth.organizationId}`, RATE_LIMITS.api);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.api) },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get("experimentId");
    const type = searchParams.get("type");

    if (!experimentId) {
      return NextResponse.json({ error: "experimentId is required" }, { status: 400 });
    }

    if (!UUID_REGEX.test(experimentId)) {
      return NextResponse.json({ error: "Invalid experimentId format" }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      experimentId,
      experiment: { knowledgeBase: { project: { organizationId: auth.organizationId } } },
    };
    if (type) where.type = type;

    const artifacts = await prisma.experimentArtifact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ artifacts, total: artifacts.length });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

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

  const experimentId = typeof body.experimentId === "string" ? body.experimentId.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!experimentId || !UUID_REGEX.test(experimentId)) {
    return NextResponse.json({ error: "experimentId is required and must be a valid UUID" }, { status: 400 });
  }
  if (!type || type.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "type is required and must be under 255 characters" }, { status: 400 });
  }
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "name is required and must be under 255 characters" }, { status: 400 });
  }

  try {
    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId, knowledgeBase: { project: { organizationId: auth.organizationId } } },
      select: { id: true },
    });
    if (!experiment) {
      return NextResponse.json({ error: "experimentId is not accessible" }, { status: 403 });
    }

    const artifact = await prisma.experimentArtifact.create({
      data: {
        experimentId,
        type,
        name,
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "application/octet-stream",
        size: typeof body.size === "number" && body.size >= 0 ? body.size : 0,
        data: body.data as never,
      },
    });

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}


