"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { logger } from "@/lib/logger";

// ============================================================================
// Audit Log Actions
// ============================================================================

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export async function listAuditLogs(
  organizationId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: string;
    resource?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  success: boolean;
  logs?: AuditLogEntry[];
  total?: number;
  error?: string;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const { limit = 50, offset = 0, action, resource, userId, startDate, endDate } = options;

    const where: Record<string, unknown> = { organizationId };
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      logs: logs.map((log) => ({
        ...log,
        details: log.details as Record<string, unknown> | null,
      })),
      total,
    };
  } catch (error) {
    logger.error("Failed to list audit logs", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list audit logs",
    };
  }
}

export async function getAuditLogStats(organizationId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const [todayCount, weekCount, monthCount, totalCount, topActions, topUsers] =
      await Promise.all([
        prisma.auditLog.count({
          where: { organizationId, createdAt: { gte: todayStart } },
        }),
        prisma.auditLog.count({
          where: { organizationId, createdAt: { gte: weekStart } },
        }),
        prisma.auditLog.count({
          where: { organizationId, createdAt: { gte: monthStart } },
        }),
        prisma.auditLog.count({ where: { organizationId } }),
        prisma.auditLog.groupBy({
          by: ["action"],
          where: { organizationId, createdAt: { gte: weekStart } },
          _count: { action: true },
          orderBy: { _count: { action: "desc" } },
          take: 5,
        }),
        prisma.auditLog.groupBy({
          by: ["userId"],
          where: { organizationId, createdAt: { gte: weekStart } },
          _count: { userId: true },
          orderBy: { _count: { userId: "desc" } },
          take: 5,
        }),
      ]);

    return {
      success: true,
      stats: {
        today: todayCount,
        week: weekCount,
        month: monthCount,
        total: totalCount,
        topActions: topActions.map((a) => ({
          action: a.action,
          count: a._count.action,
        })),
        topUsers: topUsers.map((u) => ({
          userId: u.userId,
          count: u._count.userId,
        })),
      },
    };
  } catch (error) {
    logger.error("Failed to get audit log stats", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get stats",
    };
  }
}

export async function exportAuditLogs(
  organizationId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    format?: "json" | "csv";
  } = {}
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const { startDate, endDate, format = "json" } = options;

    const where: Record<string, unknown> = { organizationId };
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    if (format === "csv") {
      const headers = ["Timestamp", "User", "Email", "Action", "Resource", "Resource ID", "Details"];
      const rows = logs.map((log) => [
        log.createdAt.toISOString(),
        log.user.name || "",
        log.user.email,
        log.action,
        log.resource,
        log.resourceId || "",
        JSON.stringify(log.details || {}),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join(
        "\n"
      );

      return { success: true, data: csv, format: "csv" };
    }

    return { success: true, data: logs, format: "json" };
  } catch (error) {
    logger.error("Failed to export audit logs", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export audit logs",
    };
  }
}
