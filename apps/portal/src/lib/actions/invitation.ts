"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { getMembership, hasPermission } from "@/lib/rbac";
import { safeRevalidate as revalidatePath } from "@/lib/revalidation";
import { logger } from "@/lib/logger";
import {
  inviteMember,
  acceptInvitation,
  revokeInvitation,
  getOrganizationInvitations,
  getUserInvitations,
  type InviteMemberInput,
} from "@/lib/organizations";

// ============================================================================
// Invitation Actions
// ============================================================================

export async function sendInvitation(
  organizationId: string,
  input: InviteMemberInput
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    if (!(await getMembership(session.user.id, organizationId))) {
      throw new Error("Organization not found");
    }

    const result = await inviteMember(organizationId, session.user.id, input);
    revalidatePath("/app/settings/members");
    return { success: true, invitationId: result.invitationId };
  } catch (error) {
    logger.error("Failed to send invitation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invitation",
    };
  }
}

export async function acceptOrganizationInvitation(token: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const result = await acceptInvitation(token, session.user.id);
    revalidatePath("/app");
    return { success: true, organizationId: result.organizationId };
  } catch (error) {
    logger.error("Failed to accept invitation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to accept invitation",
    };
  }
}

export async function revokeOrganizationInvitation(
  organizationId: string,
  invitationId: string
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    if (!(await getMembership(session.user.id, organizationId))) {
      throw new Error("Organization not found");
    }

    const revoked = await revokeInvitation(invitationId, session.user.id);
    if (!revoked) {
      return { success: false, error: "Invitation not found" };
    }

    revalidatePath("/app/settings/members");
    return { success: true };
  } catch (error) {
    logger.error("Failed to revoke invitation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revoke invitation",
    };
  }
}

export async function listOrganizationInvitations(organizationId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const membership = await getMembership(session.user.id, organizationId);
    if (!membership) {
      throw new Error("Organization not found");
    }
    // Pending invitations carry invitee emails and are an administrative concern;
    // gate reads on the same permission that guards issuing and revoking them.
    if (!hasPermission(membership.role, "manage_invitations")) {
      throw new Error("Viewing invitations requires admin access");
    }

    const invitations = await getOrganizationInvitations(organizationId);
    return { success: true, invitations };
  } catch (error) {
    logger.error("Failed to list invitations", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list invitations",
    };
  }
}

export async function listUserInvitations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      throw new Error("Unauthorized");
    }

    const invitations = await getUserInvitations(session.user.email);
    return { success: true, invitations };
  } catch (error) {
    logger.error("Failed to list user invitations", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list invitations",
    };
  }
}
