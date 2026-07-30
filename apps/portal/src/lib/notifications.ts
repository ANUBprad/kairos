/**
 * Notification System for Kairos Enterprise
 *
 * Provides notification creation, retrieval, and management.
 * Supports various notification types with metadata.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

export type NotificationType =
  | "experiment.completed"
  | "experiment.failed"
  | "upload.completed"
  | "upload.failed"
  | "evaluation.completed"
  | "invitation.received"
  | "permission.updated"
  | "api_key.rotated"
  | "member.joined"
  | "member.removed"
  | "settings.updated"
  | "system.update";

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationInfo {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    logger.info("Notification created", {
      userId,
      type: input.type,
      title: input.title,
    });
  } catch (error) {
    logger.error("Failed to create notification", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      type: input.type,
    });
  }
}

export async function createBulkNotifications(
  userIds: string[],
  input: CreateNotificationInput
): Promise<void> {
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      })),
    });

    logger.info("Bulk notifications created", {
      count: userIds.length,
      type: input.type,
    });
  } catch (error) {
    logger.error("Failed to create bulk notifications", {
      error: error instanceof Error ? error.message : String(error),
      count: userIds.length,
    });
  }
}

export async function getUserNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
  } = {}
): Promise<{ notifications: NotificationInfo[]; total: number; unreadCount: number }> {
  const { limit = 20, offset = 0, unreadOnly = false, type } = options;

  const where: Record<string, unknown> = { userId };
  if (unreadOnly) {
    where.read = false;
  }
  if (type) {
    where.type = type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      ...n,
      metadata: n.metadata as Record<string, unknown> | null,
    })),
    total,
    unreadCount,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

export async function markAsRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: { read: true },
  });

  return result.count > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: { read: true },
  });

  return result.count;
}

export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });

  return result.count > 0;
}

export async function deleteAllNotifications(userId: string): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: { userId },
  });

  return result.count;
}

export async function notifyExperimentCompleted(
  userId: string,
  experimentId: string,
  experimentName: string
): Promise<void> {
  await createNotification(userId, {
    type: "experiment.completed",
    title: "Experiment Completed",
    message: `Your experiment "${experimentName}" has completed successfully.`,
    metadata: { experimentId, experimentName },
  });
}

export async function notifyExperimentFailed(
  userId: string,
  experimentId: string,
  experimentName: string,
  error: string
): Promise<void> {
  await createNotification(userId, {
    type: "experiment.failed",
    title: "Experiment Failed",
    message: `Your experiment "${experimentName}" has failed: ${error}`,
    metadata: { experimentId, experimentName, error },
  });
}

export async function notifyUploadCompleted(
  userId: string,
  documentId: string,
  documentName: string
): Promise<void> {
  await createNotification(userId, {
    type: "upload.completed",
    title: "Upload Complete",
    message: `Document "${documentName}" has been processed and is ready.`,
    metadata: { documentId, documentName },
  });
}

export async function notifyUploadFailed(
  userId: string,
  documentId: string,
  documentName: string,
  error: string
): Promise<void> {
  await createNotification(userId, {
    type: "upload.failed",
    title: "Upload Failed",
    message: `Document "${documentName}" failed to process: ${error}`,
    metadata: { documentId, documentName, error },
  });
}

export async function notifyInvitationReceived(
  userId: string,
  organizationName: string,
  invitationId: string
): Promise<void> {
  await createNotification(userId, {
    type: "invitation.received",
    title: "Organization Invitation",
    message: `You've been invited to join "${organizationName}".`,
    metadata: { organizationName, invitationId },
  });
}

export async function notifyPermissionUpdated(
  userId: string,
  organizationName: string,
  newRole: string
): Promise<void> {
  await createNotification(userId, {
    type: "permission.updated",
    title: "Permissions Updated",
    message: `Your role in "${organizationName}" has been updated to ${newRole}.`,
    metadata: { organizationName, newRole },
  });
}
