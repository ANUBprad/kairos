/**
 * Organization Management for Kairos Enterprise
 *
 * Provides organization CRUD, member management, and invitation handling.
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import {
  createAuditLog,
  getMembership,
} from "./rbac";
import { createNotification } from "./notifications";
import type { MemberRole } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  ownerId: string;
  memberCount: number;
  projectCount: number;
  createdAt: Date;
}

export interface MemberInfo {
  id: string;
  userId: string;
  role: MemberRole;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  invitedBy: string | null;
  createdAt: Date;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  logo?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  logo?: string;
}

export interface InviteMemberInput {
  email: string;
  role: MemberRole;
}

// ============================================================================
// Organization CRUD
// ============================================================================

/**
 * Create a new organization
 */
export async function createOrganization(
  ownerId: string,
  input: CreateOrganizationInput
): Promise<OrganizationInfo> {
  const existing = await prisma.organization.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error("Organization slug already exists");
  }

  const organization = await prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
      logo: input.logo,
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: "OWNER",
        },
      },
      projects: {
        create: {
          name: "Default Project",
          slug: "default",
          description: "Default project for the organization",
        },
      },
    },
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });

  await createAuditLog(ownerId, organization.id, {
    action: "organization.created",
    resource: "organization",
    resourceId: organization.id,
    details: { name: input.name, slug: input.slug },
  });

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    ownerId: organization.ownerId,
    memberCount: organization._count.members,
    projectCount: organization._count.projects,
    createdAt: organization.createdAt,
  };
}

/**
 * Get organization by ID
 */
export async function getOrganization(
  organizationId: string
): Promise<OrganizationInfo | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });

  if (!organization) return null;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    ownerId: organization.ownerId,
    memberCount: organization._count.members,
    projectCount: organization._count.projects,
    createdAt: organization.createdAt,
  };
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(
  slug: string
): Promise<OrganizationInfo | null> {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });

  if (!organization) return null;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    ownerId: organization.ownerId,
    memberCount: organization._count.members,
    projectCount: organization._count.projects,
    createdAt: organization.createdAt,
  };
}

/**
 * Update organization
 */
export async function updateOrganization(
  organizationId: string,
  userId: string,
  input: UpdateOrganizationInput
): Promise<OrganizationInfo | null> {
  const membership = await getMembership(userId, organizationId);
  if (!membership || membership.role !== "OWNER") {
    throw new Error("Only the organization owner can update organization settings");
  }

  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: input,
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });

  await createAuditLog(userId, organizationId, {
    action: "organization.updated",
    resource: "organization",
    resourceId: organizationId,
    details: { ...input },
  });

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    ownerId: organization.ownerId,
    memberCount: organization._count.members,
    projectCount: organization._count.projects,
    createdAt: organization.createdAt,
  };
}

/**
 * Get all organizations for a user
 */
export async function getUserOrganizations(
  userId: string
): Promise<OrganizationInfo[]> {
  const memberships = await prisma.member.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              members: true,
              projects: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    logo: m.organization.logo,
    ownerId: m.organization.ownerId,
    memberCount: m.organization._count.members,
    projectCount: m.organization._count.projects,
    createdAt: m.organization.createdAt,
  }));
}

// ============================================================================
// Member Management
// ============================================================================

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<MemberInfo[]> {
  const members = await prisma.member.findMany({
    where: { organizationId },
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
    orderBy: { createdAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role as MemberRole,
    user: m.user,
    invitedBy: m.invitedBy,
    createdAt: m.createdAt,
  }));
}

/**
 * Add a member to an organization
 */
export async function addMember(
  organizationId: string,
  userId: string,
  role: MemberRole,
  invitedBy?: string
): Promise<void> {
  const existing = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });

  if (existing) {
    throw new Error("User is already a member of this organization");
  }

  await prisma.member.create({
    data: {
      organizationId,
      userId,
      role,
      invitedBy,
    },
  });

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  await createNotification(userId, {
    type: "member.joined",
    title: "Joined Organization",
    message: `You've joined "${organization?.name}" as ${role}.`,
    metadata: { organizationId, role },
  });

  await createAuditLog(userId, organizationId, {
    action: "member.joined",
    resource: "member",
    details: { role, invitedBy },
  });
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  newRole: MemberRole,
  updatedBy: string
): Promise<void> {
  const membership = await getMembership(updatedBy, organizationId);
  if (!membership || membership.role !== "OWNER") {
    throw new Error("Only the organization owner can update member roles");
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { userId: true, role: true },
  });

  if (!member) {
    throw new Error("Member not found");
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { role: newRole },
  });

  await createNotification(member.userId, {
    type: "permission.updated",
    title: "Role Updated",
    message: `Your role has been updated to ${newRole}.`,
    metadata: { organizationId, oldRole: member.role, newRole },
  });

  await createAuditLog(updatedBy, organizationId, {
    action: "member.role_updated",
    resource: "member",
    resourceId: memberId,
    details: { oldRole: member.role, newRole },
  });
}

/**
 * Remove a member from an organization
 */
export async function removeMember(
  organizationId: string,
  memberId: string,
  removedBy: string
): Promise<void> {
  const membership = await getMembership(removedBy, organizationId);
  if (!membership || membership.role !== "OWNER") {
    throw new Error("Only the organization owner can remove members");
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { userId: true, role: true },
  });

  if (!member) {
    throw new Error("Member not found");
  }

  if (member.role === "OWNER") {
    throw new Error("Cannot remove the organization owner");
  }

  await prisma.member.delete({
    where: { id: memberId },
  });

  await createNotification(member.userId, {
    type: "member.removed",
    title: "Removed from Organization",
    message: `You've been removed from the organization.`,
    metadata: { organizationId },
  });

  await createAuditLog(removedBy, organizationId, {
    action: "member.removed",
    resource: "member",
    resourceId: memberId,
    details: { removedUserId: member.userId, role: member.role },
  });
}

// ============================================================================
// Invitation Management
// ============================================================================

/**
 * Generate an invitation token
 */
function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Invite a user to an organization
 */
export async function inviteMember(
  organizationId: string,
  invitedById: string,
  input: InviteMemberInput
): Promise<{ invitationId: string; token: string }> {
  const membership = await getMembership(invitedById, organizationId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only owners and admins can invite members");
  }

  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId,
      user: { email: input.email },
    },
  });

  if (existingMember) {
    throw new Error("User is already a member of this organization");
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      organizationId,
      email: input.email,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    throw new Error("An invitation has already been sent to this email");
  }

  const token = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      email: input.email,
      role: input.role,
      token,
      organizationId,
      invitedById,
      expiresAt,
    },
  });

  // Try to notify existing user if they have an account
  const invitee = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (invitee) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    await createNotification(invitee.id, {
      type: "invitation.received",
      title: "Organization Invitation",
      message: `You've been invited to join "${organization?.name}".`,
      metadata: { invitationId: invitation.id, organizationId, role: input.role },
    });
  }

  await createAuditLog(invitedById, organizationId, {
    action: "invitation.sent",
    resource: "invitation",
    resourceId: invitation.id,
    details: { email: input.email, role: input.role },
  });

  return { invitationId: invitation.id, token };
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<{ organizationId: string }> {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organizationId: true,
    },
  });

  if (!invitation) {
    throw new Error("Invalid invitation token");
  }

  if (invitation.status !== "PENDING") {
    throw new Error("This invitation has already been used or revoked");
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error("This invitation has expired");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user || user.email !== invitation.email) {
    throw new Error("This invitation is for a different email address");
  }

  await addMember(invitation.organizationId, userId, invitation.role as MemberRole);

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  await createAuditLog(userId, invitation.organizationId, {
    action: "invitation.accepted",
    resource: "invitation",
    resourceId: invitation.id,
    details: { email: invitation.email, role: invitation.role },
  });

  return { organizationId: invitation.organizationId };
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(
  invitationId: string,
  revokedBy: string
): Promise<boolean> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { organizationId: true, status: true },
  });

  if (!invitation) {
    return false;
  }

  const membership = await getMembership(revokedBy, invitation.organizationId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only owners and admins can revoke invitations");
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });

  await createAuditLog(revokedBy, invitation.organizationId, {
    action: "invitation.revoked",
    resource: "invitation",
    resourceId: invitationId,
  });

  return true;
}

/**
 * Get pending invitations for an organization
 */
export async function getOrganizationInvitations(
  organizationId: string
): Promise<Array<{
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}>> {
  return prisma.invitation.findMany({
    where: {
      organizationId,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

/**
 * Get user's pending invitations
 */
export async function getUserInvitations(
  email: string
): Promise<Array<{
  id: string;
  organization: { id: string; name: string; logo: string | null };
  role: MemberRole;
  expiresAt: Date;
  createdAt: Date;
}>> {
  const invitations = await prisma.invitation.findMany({
    where: {
      email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          logo: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map((i) => ({
    id: i.id,
    organization: i.organization,
    role: i.role as MemberRole,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));
}
