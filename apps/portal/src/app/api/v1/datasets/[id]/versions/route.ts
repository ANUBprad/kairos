import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function validateApiKey(request: NextRequest): boolean {
  return !!request.headers.get("x-api-key");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

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

  const dataset = await prisma.benchmarkDataset.create({
    data: {
      name: body.name ?? `${parent.name} v${newVersion}`,
      description: body.description ?? parent.description,
      source: parent.source,
      tags: body.tags ?? parent.tags,
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
}
