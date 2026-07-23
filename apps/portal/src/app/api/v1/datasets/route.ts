import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function validateApiKey(request: NextRequest): boolean {
  return !!request.headers.get("x-api-key");
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const [datasets, total] = await Promise.all([
    prisma.benchmarkDataset.findMany({
      include: {
        _count: { select: { questions: true, runs: true, childVersions: true } },
        parentVersion: { select: { id: true, name: true, version: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.benchmarkDataset.count(),
  ]);

  return NextResponse.json({ datasets, total, limit, offset });
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const body = await request.json();
  const { name, description, source, tags, knowledgeBaseId } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const dataset = await prisma.benchmarkDataset.create({
    data: {
      name,
      description,
      source,
      tags: tags ?? [],
      knowledgeBaseId,
    },
  });

  return NextResponse.json(dataset, { status: 201 });
}
