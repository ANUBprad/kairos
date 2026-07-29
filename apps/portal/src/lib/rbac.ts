/**
 * Role-Based Access Control (RBAC) System for Kairos Enterprise
 *
 * This module defines the permission model, role hierarchy, and provides
 * utility functions for checking permissions across the application.
 *
 * Roles (from highest to lowest privilege):
 * - OWNER: Full access to everything in the organization
 * - ADMIN: Can manage users, settings, and all resources
 * - MEMBER: Can create, edit, and run experiments
 * - VIEWER: Read-only access to all resources
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export type Permission =
  // Resource permissions
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "share"
  | "export"
  // Feature permissions
  | "run_experiments"
  | "manage_users"
  | "manage_settings"
  | "manage_api_keys"
  | "manage_billing"
  // Organization permissions
  | "view_organization"
  | "edit_organization"
  | "delete_organization"
  // Admin permissions
  | "view_audit_logs"
  | "view_admin_dashboard"
  | "manage_members"
  | "manage_invitations";

export type ResourceType =
  | "organization"
  | "project"
  | "knowledge_base"
  | "document"
  | "experiment"
  | "dataset"
  | "artifact"
  | "api_key"
  | "user"
  | "settings"
  | "audit_log"
  | "notification"
  | "share_link"
  | "conversation";

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

// ============================================================================
// Role Definitions
// ============================================================================

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [
    "view", "create", "edit", "delete", "share", "export",
    "run_experiments", "manage_users", "manage_settings", "manage_api_keys",
    "manage_billing", "view_organization", "edit_organization", "delete_organization",
    "view_audit_logs", "view_admin_dashboard", "manage_members", "manage_invitations",
  ],
  ADMIN: [
    "view", "create", "edit", "delete", "share", "export",
    "run_experiments", "manage_users", "manage_settings", "manage_api_keys",
    "view_organization", "edit_organization",
    "view_audit_logs", "view_admin_dashboard", "manage_members", "manage_invitations",
  ],
  MEMBER: [
    "view", "create", "edit", "share", "export",
    "run_experiments",
    "view_organization",
  ],
  VIEWER: [
    "view",
    "view_organization",
  ],
};

// ============================================================================
// Permission Utilities
// ============================================================================

/**
 * Get all permissions for a given role
 */
export function getRolePermissions(role: MemberRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}

/**
 * Check if a role has all specified permissions
 */
export function hasAllPermissions(role: MemberRole, permissions: Permission[]): boolean {
  const rolePermissions = getRolePermissions(role);
  return permissions.every((p) => rolePermissions.includes(p));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: MemberRole, permissions: Permission[]): boolean {
  const rolePermissions = getRolePermissions(role);
  return permissions.some((p) => rolePermissions.includes(p));
}

// ============================================================================
// Database Permission Checks
// ============================================================================

export interface MembershipContext {
  userId: string;
  organizationId: string;
  role: MemberRole;
  memberId: string;
}

/**
 * Get the user's membership in an organization
 */
export async function getMembership(
  userId: string,
  organizationId: string
): Promise<MembershipContext | null> {
  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
      userId: true,
    },
  });

  if (!member) return null;

  return {
    userId: member.userId,
    organizationId: member.organizationId,
    role: member.role as MemberRole,
    memberId: member.id,
  };
}

/**
 * Get the user's membership for a resource (via organization hierarchy)
 */
export async function getMembershipForResource(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<MembershipContext | null> {
  let organizationId: string | undefined;

  switch (resourceType) {
    case "organization":
      organizationId = resourceId;
      break;
    case "project": {
      const project = await prisma.project.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      });
      organizationId = project?.organizationId;
      break;
    }
    case "knowledge_base": {
      const kb = await prisma.knowledgeBase.findUnique({
        where: { id: resourceId },
        select: { project: { select: { organizationId: true } } },
      });
      organizationId = kb?.project?.organizationId;
      break;
    }
    case "document": {
      const doc = await prisma.document.findUnique({
        where: { id: resourceId },
        select: { knowledgeBase: { select: { project: { select: { organizationId: true } } } } },
      });
      organizationId = doc?.knowledgeBase?.project?.organizationId;
      break;
    }
    case "experiment": {
      const exp = await prisma.experiment.findUnique({
        where: { id: resourceId },
        select: { knowledgeBase: { select: { project: { select: { organizationId: true } } } } },
      });
      organizationId = exp?.knowledgeBase?.project?.organizationId;
      break;
    }
    case "dataset": {
      const ds = await prisma.benchmarkDataset.findUnique({
        where: { id: resourceId },
        select: { knowledgeBase: { select: { project: { select: { organizationId: true } } } } },
      });
      organizationId = ds?.knowledgeBase?.project?.organizationId;
      break;
    }
    case "api_key": {
      const key = await prisma.apiKey.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      });
      organizationId = key?.organizationId;
      break;
    }
    case "settings": {
      const ws = await prisma.workspaceSettings.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      });
      organizationId = ws?.organizationId;
      break;
    }
    case "audit_log": {
      const al = await prisma.auditLog.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      });
      organizationId = al?.organizationId;
      break;
    }
    case "share_link": {
      const sl = await prisma.shareLink.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      });
      organizationId = sl?.organizationId;
      break;
    }
    default:
      return null;
  }

  if (!organizationId) return null;
  return getMembership(userId, organizationId);
}

/**
 * Check if a user has a specific permission for a resource
 */
export async function checkPermission(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  permission: Permission
): Promise<boolean> {
  const membership = await getMembershipForResource(userId, resourceType, resourceId);
  if (!membership) return false;
  return hasPermission(membership.role, permission);
}

/**
 * Require a permission or throw an error
 */
export async function requirePermission(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  permission: Permission
): Promise<MembershipContext> {
  const membership = await getMembershipForResource(userId, resourceType, resourceId);
  if (!membership) {
    throw new Error(`Access denied: not a member of this organization`);
  }
  if (!hasPermission(membership.role, permission)) {
    throw new Error(`Access denied: ${permission} requires ${getRequiredRole(permission)} role or higher`);
  }
  return membership;
}

/**
 * Get the minimum role required for a permission
 */
export function getRequiredRole(permission: Permission): MemberRole {
  const roles: MemberRole[] = ["VIEWER", "MEMBER", "ADMIN", "OWNER"];
  for (const role of roles) {
    if (hasPermission(role, permission)) {
      return role;
    }
  }
  return "OWNER";
}

/**
 * Check if the user's role is sufficient for the required role
 */
export function isRoleSufficient(userRole: MemberRole, requiredRole: MemberRole): boolean {
  const roleHierarchy: Record<MemberRole, number> = {
    VIEWER: 0,
    MEMBER: 1,
    ADMIN: 3,
    OWNER: 4,
  };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  userId: string,
  organizationId: string,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details as Prisma.InputJsonValue | undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        requestId: entry.requestId,
      },
    });
  } catch (error) {
    logger.error("Failed to create audit log", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      organizationId,
      action: entry.action,
    });
  }
}

/**
 * Create an activity log entry (backward compatible)
 */
export async function createActivityLog(
  userId: string,
  action: string,
  resource?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    logger.error("Failed to create activity log", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      action,
    });
  }
}

// ============================================================================
// RBAC Middleware Helper
// ============================================================================

/**
 * Middleware helper to check permissions and return membership context
 */
export async function withPermissionCheck(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  permission: Permission
): Promise<{ allowed: boolean; membership?: MembershipContext; error?: string }> {
  try {
    const membership = await requirePermission(userId, resourceType, resourceId, permission);
    return { allowed: true, membership };
  } catch (error) {
    return {
      allowed: false,
      error: error instanceof Error ? error.message : "Permission denied",
    };
  }
}
