import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

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

    const maxVersion = await prisma.benchmarkDataset.aggregate({
      where: {
        OR: [
          { id, knowledgeBase: { project: { organizationId: auth.organizationId } } },
          { parentVersionId: id, knowledgeBase: { project: { organizationId: auth.organizationId } } },
        ],
      },
      _max: { version: true },
    });

    const maxVersionValue = maxVersion._max?.version ?? parent.version;
    const newVersion = maxVersionValue + 1;

    const questions = await prisma.benchmarkQuestion.findMany({
      where: { datasetId: id },
    });

    const name = typeof body.name === "string" ? body.name.trim() : `${parent.name} v${newVersion}`;
    if (name.length > 255) {
      return NextResponse.json({ error: "Name must be under 255 characters" }, { status: 400 });
    }

    const dataset = await prisma.benchmarkDataset.create({
      data: {
        name,
        description: typeof body.description === "string" ? body.description : parent.description,
        source: parent.source,
        tags: Array.isArray(body.tags) ? body.tags : parent.tags,
        version: newVersion,
        parentVersionId: id,
        knowledgeBaseId: parent.knowledgeBaseId,
        questions: {
          create: questions.map((q) => ({
            question: q.question,
            expectedAnswer: q.expectedAnswer,
            expectedContext: q.expectedContext,
            referenceDocId: q.referenceDocId,
            metadata: (q.metadata || undefined) as never,
          })),
        },
      },
    });

    return NextResponse.json(dataset, { status: 201 });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}
