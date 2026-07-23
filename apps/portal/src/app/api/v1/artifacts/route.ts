import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function validateApiKey(request: NextRequest): boolean {
  return !!request.headers.get("x-api-key");
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get("experimentId");
  const type = searchParams.get("type");

  if (!experimentId) {
    return NextResponse.json({ error: "experimentId is required" }, { status: 400 });
  }

  const where: Record<string, unknown> = { experimentId };
  if (type) where.type = type;

  const artifacts = await prisma.experimentArtifact.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ artifacts, total: artifacts.length });
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const body = await request.json();
  const { experimentId, type, name, mimeType, size, data } = body;

  if (!experimentId || !type || !name) {
    return NextResponse.json({ error: "experimentId, type, and name are required" }, { status: 400 });
  }

  const artifact = await prisma.experimentArtifact.create({
    data: {
      experimentId,
      type,
      name,
      mimeType: mimeType ?? "application/octet-stream",
      size: size ?? 0,
      data: data ?? undefined,
    },
  });

  return NextResponse.json(artifact, { status: 201 });
}
