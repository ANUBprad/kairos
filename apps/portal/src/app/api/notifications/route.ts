import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeError } from "@/lib/errors";
import { DEMO_USER_ID } from "@/lib/server/demo-user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, message: true, read: true, createdAt: true, type: true },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: DEMO_USER_ID, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    const { message, errorId } = sanitizeError(err);
    return NextResponse.json({ error: message, errorId }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: DEMO_USER_ID },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: DEMO_USER_ID, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const { message, errorId } = sanitizeError(err);
    return NextResponse.json({ error: message, errorId }, { status: 500 });
  }
}
