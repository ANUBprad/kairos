"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";
import { createAuditLog } from "@/lib/rbac";
import type { SharePermission } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface ShareLinkInfo {
  id: string;
  token: string;
  resourceType: string;
  resourceId: string;
  permission: SharePermission;
  expiresAt: Date | null;
  enabled: boolean;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

// ============================================================================
// Share Link Actions
// ============================================================================

export async function createShareLink(
  organizationId: string,
  resourceType: string,
  resourceId: string,
  options: {
    permission?: SharePermission;
    expiresAt?: Date;
  } = {}
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const token = randomBytes(32).toString("hex");

    const shareLink = await prisma.shareLink.create({
      data: {
        token,
        resourceType,
        resourceId,
        permission: options.permission || "VIEW",
        organizationId,
        createdById: session.user.id,
        expiresAt: options.expiresAt,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await createAuditLog(session.user.id, organizationId, {
      action: "share_link.created",
      resource: "share_link",
      resourceId: shareLink.id,
      details: { resourceType, resourceId, permission: options.permission },
    });

    revalidatePath("/app");
    return { success: true, shareLink };
  } catch (error) {
    logger.error("Failed to create share link", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create share link",
    };
  }
}

export async function getShareLinks(
  organizationId: string,
  resourceType: string,
  resourceId: string
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const shareLinks = await prisma.shareLink.findMany({
      where: {
        organizationId,
        resourceType,
        resourceId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, shareLinks };
  } catch (error) {
    logger.error("Failed to get share links", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get share links",
    };
  }
}

export async function revokeShareLink(organizationId: string, shareLinkId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await prisma.shareLink.delete({
      where: {
        id: shareLinkId,
        organizationId,
      },
    });

    await createAuditLog(session.user.id, organizationId, {
      action: "share_link.revoked",
      resource: "share_link",
      resourceId: shareLinkId,
    });

    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    logger.error("Failed to revoke share link", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revoke share link",
    };
  }
}

export async function accessShareLink(token: string) {
  try {
    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!shareLink) {
      return { success: false, error: "Share link not found" };
    }

    if (!shareLink.enabled) {
      return { success: false, error: "Share link has been disabled" };
    }

    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      return { success: false, error: "Share link has expired" };
    }

    return {
      success: true,
      shareLink: {
        id: shareLink.id,
        resourceType: shareLink.resourceType,
        resourceId: shareLink.resourceId,
        permission: shareLink.permission,
        organization: shareLink.organization,
        createdBy: shareLink.createdBy,
      },
    };
  } catch (error) {
    logger.error("Failed to access share link", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to access share link",
    };
  }
}

export async function listOrganizationShareLinks(organizationId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const shareLinks = await prisma.shareLink.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, shareLinks };
  } catch (error) {
    logger.error("Failed to list organization share links", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list share links",
    };
  }
}
