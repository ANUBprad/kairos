import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
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
    const parent = await prisma.benchmarkDataset.findUnique({ where: { id } });
    if (!parent) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

    const maxVersion = await prisma.benchmarkDataset.aggregate({
      where: { OR: [{ id }, { parentVersionId: id }] },
      _max: { version: true },
    });

    const newVersion = (maxVersion._max.version ?? parent.version) + 1;

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
