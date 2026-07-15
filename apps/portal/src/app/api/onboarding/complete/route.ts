import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await prisma.activityLog.create({
      data: {
        action: "onboarding.completed",
        resource: "user",
        resourceId: session.user.id,
        userId: session.user.id,
      },
    });

    logger.info("Onboarding completed", { userId: session.user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to record onboarding completion", { userId: session.user.id, error });
    return NextResponse.json({ error: "Failed to record onboarding" }, { status: 500 });
  }
}
