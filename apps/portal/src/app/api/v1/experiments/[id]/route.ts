import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_PATCH_FIELDS = ["name", "description", "isFavorite", "isArchived", "status", "winner", "tags"];

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
      include: {
        knowledgeBase: { select: { id: true, name: true } },
        dataset: { select: { id: true, name: true } },
        runs: { orderBy: { createdAt: "desc" }, take: 50 },
        artifacts: { orderBy: { createdAt: "desc" } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { runs: true, artifacts: true } },
      },
    });

    if (!experiment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(experiment);
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const existing = await prisma.experiment.findFirst({
      where: { id, knowledgeBase: { project: { organizationId: auth.organizationId } } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Whitelist allowed fields to prevent mass assignment
    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_PATCH_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const experiment = await prisma.experiment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(experiment);
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const existing = await prisma.experiment.findFirst({
      where: { id, knowledgeBase: { project: { organizationId: auth.organizationId } } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.experiment.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

