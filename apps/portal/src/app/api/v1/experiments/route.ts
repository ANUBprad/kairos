import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/server/api-auth";
import { sanitizeError } from "@/lib/errors";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIMIT = 200;
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 100;

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get("knowledgeBaseId");
    const status = searchParams.get("status");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

    const where: Record<string, unknown> = {
      knowledgeBase: { project: { organizationId: auth.organizationId } },
    };
    if (knowledgeBaseId) {
      if (!UUID_REGEX.test(knowledgeBaseId)) {
        return NextResponse.json({ error: "Invalid knowledgeBaseId format" }, { status: 400 });
      }
      where.knowledgeBaseId = knowledgeBaseId;
    }
    if (status) where.status = status;

    const [experiments, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: {
          knowledgeBase: { select: { id: true, name: true } },
          dataset: { select: { id: true, name: true } },
          runs: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { runs: true, artifacts: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.experiment.count({ where }),
    ]);

    return NextResponse.json({ experiments, total, limit, offset });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  const knowledgeBaseId = typeof body.knowledgeBaseId === "string" ? body.knowledgeBaseId.trim() : "";

  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `name is required and must be under ${MAX_NAME_LENGTH} characters` }, { status: 400 });
  }
  if (!knowledgeBaseId || !UUID_REGEX.test(knowledgeBaseId)) {
    return NextResponse.json({ error: "knowledgeBaseId is required and must be a valid UUID" }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: `description must be under ${MAX_DESCRIPTION_LENGTH} characters` }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? body.tags.slice(0, MAX_TAGS) : [];
  for (const tag of tags) {
    if (typeof tag !== "string" || tag.length > MAX_TAG_LENGTH) {
      return NextResponse.json({ error: `Each tag must be a string under ${MAX_TAG_LENGTH} characters` }, { status: 400 });
    }
  }

  try {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, project: { organizationId: auth.organizationId } },
    });
    if (!kb) {
      return NextResponse.json({ error: "knowledgeBaseId not found" }, { status: 404 });
    }

    const config = {
      embeddingModel: typeof body.embeddingModel === "string" ? body.embeddingModel : "text-embedding-3-small",
      retriever: typeof body.retriever === "string" ? body.retriever : "vector",
      reranker: typeof body.reranker === "string" ? body.reranker : "none",
      llm: typeof body.llm === "string" ? body.llm : "gpt-4o-mini",
      chunkStrategy: typeof body.chunkStrategy === "string" ? body.chunkStrategy : "fixed",
      chunkSize: typeof body.chunkSize === "number" ? body.chunkSize : 512,
      chunkOverlap: typeof body.chunkOverlap === "number" ? body.chunkOverlap : 50,
      topK: typeof body.topK === "number" ? body.topK : 10,
      similarityThreshold: typeof body.similarityThreshold === "number" ? body.similarityThreshold : 0.7,
      retrievalMode: typeof body.retrievalMode === "string" ? body.retrievalMode : "vector",
    };

    const experiment = await prisma.experiment.create({
      data: {
        name,
        description: description || undefined,
        knowledgeBaseId,
        datasetId: typeof body.datasetId === "string" ? body.datasetId : undefined,
        createdById: auth.userId,
        ...config,
        tags,
        configA: config,
      },
    });

    return NextResponse.json(experiment, { status: 201 });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

