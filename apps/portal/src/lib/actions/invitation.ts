"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { revalidatePath } from "next/cache";
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

    await revokeInvitation(invitationId, session.user.id);
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
