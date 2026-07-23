import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function validateApiKey(request: NextRequest): boolean {
  return !!request.headers.get("x-api-key");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  const { id } = await params;

  const artifact = await prisma.experimentArtifact.findUnique({
    where: { id },
    include: { experiment: { select: { id: true, name: true } } },
  });

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(artifact);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(request)) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.experimentArtifact.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.experimentArtifact.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
