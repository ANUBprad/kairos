import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { prisma } from "@/lib/prisma";
import { sanitizeError } from "@/lib/errors";
import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import { checkEntitlement } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

function generateApiKey(): string {
  const raw = randomBytes(32).toString("hex");
  return `kairos_${raw}`;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keys });
  } catch (err) {
    const { message, errorId } = sanitizeError(err);
    return NextResponse.json({ error: message, errorId }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const entitlement = await checkEntitlement(session.user.id, "apiKeys");
    if (!entitlement.allowed) {
      return NextResponse.json(
        { error: "API key limit reached. Upgrade your plan." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > 255) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 86400000)
      : null;

    const key = await prisma.apiKey.create({
      data: {
        name,
        keyPrefix,
        keyHash,
        userId: session.user.id,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ key: { ...key, rawKey } });
  } catch (err) {
    const { message, errorId } = sanitizeError(err);
    return NextResponse.json({ error: message, errorId }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { keyId } = body;

    if (!keyId || typeof keyId !== "string") {
      return NextResponse.json({ error: "keyId required" }, { status: 400 });
    }

    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: session.user.id },
    });

    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const { message, errorId } = sanitizeError(err);
    return NextResponse.json({ error: message, errorId }, { status: 500 });
  }
}
