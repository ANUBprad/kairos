"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
  Loader2,
  Trash2,
  Mail,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import {
  getOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from "@/lib/actions/organization";
import {
  sendInvitation,
  listOrganizationInvitations,
  revokeOrganizationInvitation,
} from "@/lib/actions/invitation";
interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: Date;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}

const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export function MembersSettingsClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersResult, invitationsResult] = await Promise.all([
        getOrganizationMembers("demo-org"),
        listOrganizationInvitations("demo-org"),
      ]);

      if (membersResult.success) {
        setMembers(membersResult.members || []);
      }
      if (invitationsResult.success) {
        setInvitations(invitationsResult.invitations || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;

    setInviting(true);
    setError(null);

    try {
      const result = await sendInvitation("demo-org", {
        email: inviteEmail,
        role: inviteRole as "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
      });

      if (result.success) {
        setShowInviteModal(false);
        setInviteEmail("");
        setInviteRole("MEMBER");
        await loadData();
      } else {
        setError(result.error || "Failed to send invitation");
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    const result = await removeOrganizationMember("demo-org", memberId);
    if (result.success) {
      await loadData();
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    const result = await updateOrganizationMemberRole(
      "demo-org",
      memberId,
      newRole as "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
    );
    if (result.success) {
      await loadData();
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    const result = await revokeOrganizationInvitation("demo-org", invitationId);
    if (result.success) {
      await loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Manage your organization's members and invitations."
        purpose="Invite new members and manage roles."
        relatedPages={[
          { label: "Organization", href: "/app/settings/organization" },
          { label: "Security", href: "/app/settings/security" },
        ]}
      />

      {/* Members List */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Members ({members.length})
          </h2>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            <UserPlus size={14} />
            Invite Member
          </button>
        </div>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-surface-hover transition-colors"
            >
              {member.user.image ? (
                <img
                  src={member.user.image}
                  alt={member.user.name || member.user.email}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-medium">
                  {(member.user.name || member.user.email)
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {member.user.name || "No name"}
                </p>
                <p className="text-xs text-text-tertiary truncate">
                  {member.user.email}
                </p>
              </div>

              <select
                value={member.role}
                onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                className="rounded-lg border border-border bg-bg px-2 py-1 text-xs text-text-primary focus:border-brand focus:outline-none"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleRemoveMember(member.id)}
                className="p-2 text-text-tertiary hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                title="Remove member"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Pending Invitations ({invitations.length})
          </h2>

          <div className="space-y-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border"
              >
                <div className="h-10 w-10 rounded-full bg-surface-hover flex items-center justify-center text-text-tertiary">
                  <Mail size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {invitation.email}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Invited as {invitation.role} · Expires{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                <button
                  onClick={() => handleRevokeInvitation(invitation.id)}
                  className="p-2 text-text-tertiary hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                  title="Revoke invitation"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowInviteModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  Invite Member
                </h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-text-tertiary hover:text-text-secondary"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
                    placeholder="colleague@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
                  >
                    <option value="VIEWER">Viewer - Can view resources</option>
                    <option value="MEMBER">Member - Can edit resources</option>
                    <option value="ADMIN">Admin - Can manage members</option>
                  </select>
                </div>

                {error && (
                  <p className="text-sm text-error">{error}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  {inviting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
