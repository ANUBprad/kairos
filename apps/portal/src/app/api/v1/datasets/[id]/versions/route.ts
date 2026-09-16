import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import {
  createBenchmarkDatasetVersion,
  listBenchmarkDatasetVersions,
} from "@/lib/evaluation/benchmark";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const parent = await prisma.benchmarkDataset.findFirst({
      where: { id, knowledgeBase: { project: { organizationId: auth.organizationId } } },
    });
    if (!parent) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    if (name && name.length > 255) {
      return NextResponse.json({ error: "Name must be under 255 characters" }, { status: 400 });
    }

    const dataset = await createBenchmarkDatasetVersion(id, {
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    });

    return NextResponse.json(dataset, { status: 201 });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

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
    const parent = await prisma.benchmarkDataset.findFirst({
      where: { id, knowledgeBase: { project: { organizationId: auth.organizationId } } },
    });
    if (!parent) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

    return NextResponse.json(await listBenchmarkDatasetVersions(id));
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}
