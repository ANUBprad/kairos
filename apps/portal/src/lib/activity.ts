import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import type { Prisma } from "@prisma/client";

export async function logActivity(
  orgId: string,
  action: string,
  resource: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return;
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        action,
        resource,
        resourceId,
        details: metadata as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Activity logging failure should not fail the user operation
  }
}
