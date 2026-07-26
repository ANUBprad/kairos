import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";

const MAX_LIMIT = 200;
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;

export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

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
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `name is required and must be under ${MAX_NAME_LENGTH} characters` }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: `description must be under ${MAX_DESCRIPTION_LENGTH} characters` }, { status: 400 });
  }

  try {
    const dataset = await prisma.benchmarkDataset.create({
      data: {
        name,
        description: description || undefined,
        source: typeof body.source === "string" ? body.source : undefined,
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
        knowledgeBaseId: typeof body.knowledgeBaseId === "string" ? body.knowledgeBaseId : undefined,
      },
    });

    return NextResponse.json(dataset, { status: 201 });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}
