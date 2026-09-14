"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { getMembership } from "@/lib/rbac";
import { APP_WORKSPACE_ORG_COOKIE } from "@/lib/server/workspace";
import {
  createOrganization as createOrg,
  updateOrganization as updateOrg,
  getUserOrganizations,
  getOrganization,
  getOrganizationMembers as getMembers,
  addMember,
  updateMemberRole,
  removeMember,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "@/lib/organizations";
import type { MemberRole } from "@prisma/client";

// ============================================================================
// Organization Actions
// ============================================================================

export async function createOrganization(input: CreateOrganizationInput) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const organization = await createOrg(session.user.id, input);
    revalidatePath("/app");
    return { success: true, organization };
  } catch (error) {
    logger.error("Failed to create organization", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create organization",
    };
  }
}

/**
 * Switches the active workspace organization for the current session.
 * The org id is validated against the caller's membership before it is
 * persisted; a non-member (or forged) org id is rejected outright so a
 * cookie can never be used to hop into another tenant.
 */
export async function switchWorkspaceOrganization(organizationId: string) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const membership = await getMembership(session.user.id, organizationId);
  if (!membership) {
    throw new Error("Organization not found");
  }

  const cookieStore = await cookies();
  cookieStore.set(APP_WORKSPACE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  revalidatePath("/app", "layout");
}

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const organization = await updateOrg(organizationId, session.user.id, input);
    revalidatePath("/app/settings");
    return { success: true, organization };
  } catch (error) {
    logger.error("Failed to update organization", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update organization",
    };
  }
}

export async function getOrganizationDetails(organizationId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const organization = await getOrganization(organizationId);
    if (!organization) {
      return { success: false, error: "Organization not found" };
    }

    return { success: true, organization };
  } catch (error) {
    logger.error("Failed to get organization", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get organization",
    };
  }
}

export async function listOrganizations() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const organizations = await getUserOrganizations(session.user.id);
    return { success: true, organizations };
  } catch (error) {
    logger.error("Failed to list organizations", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list organizations",
    };
  }
}

// ============================================================================
// Member Actions
// ============================================================================

export async function getOrganizationMembers(organizationId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const members = await getMembers(organizationId);
    return { success: true, members };
  } catch (error) {
    logger.error("Failed to get organization members", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get members",
    };
  }
}

export async function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: MemberRole
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await addMember(organizationId, userId, role, session.user.id);
    revalidatePath("/app/settings/members");
    return { success: true };
  } catch (error) {
    logger.error("Failed to add organization member", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add member",
    };
  }
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  memberId: string,
  newRole: MemberRole
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await updateMemberRole(organizationId, memberId, newRole, session.user.id);
    revalidatePath("/app/settings/members");
    return { success: true };
  } catch (error) {
    logger.error("Failed to update member role", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update member role",
    };
  }
}

export async function removeOrganizationMember(
  organizationId: string,
  memberId: string
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await removeMember(organizationId, memberId, session.user.id);
    revalidatePath("/app/settings/members");
    return { success: true };
  } catch (error) {
    logger.error("Failed to remove organization member", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove member",
    };
  }
}
