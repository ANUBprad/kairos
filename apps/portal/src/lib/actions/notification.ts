"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  type NotificationType,
} from "@/lib/notifications";

// ============================================================================
// Notification Actions
// ============================================================================

export async function listNotifications(options: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
} = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const result = await getUserNotifications(session.user.id, options);
    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to list notifications", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list notifications",
    };
  }
}

export async function getNotificationUnreadCount() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const count = await getUnreadCount(session.user.id);
    return { success: true, count };
  } catch (error) {
    logger.error("Failed to get unread count", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get unread count",
    };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await markAsRead(session.user.id, notificationId);
    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    logger.error("Failed to mark notification as read", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark as read",
    };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const count = await markAllAsRead(session.user.id);
    revalidatePath("/app");
    return { success: true, count };
  } catch (error) {
    logger.error("Failed to mark all notifications as read", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark all as read",
    };
  }
}

export async function removeNotification(notificationId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await deleteNotification(session.user.id, notificationId);
    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete notification", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete notification",
    };
  }
}

export async function clearAllNotifications() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const count = await deleteAllNotifications(session.user.id);
    revalidatePath("/app");
    return { success: true, count };
  } catch (error) {
    logger.error("Failed to clear all notifications", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear notifications",
    };
  }
}
