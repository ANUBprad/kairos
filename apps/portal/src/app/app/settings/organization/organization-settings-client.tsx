"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import {
  getOrganizationDetails,
  updateOrganization,
} from "@/lib/actions/organization";
interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  ownerId: string;
  memberCount: number;
  projectCount: number;
}

export function OrganizationSettingsClient() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    setLoading(true);
    try {
      // For demo mode, use a default organization
      const result = await getOrganizationDetails("demo-org");
      if (result.success && result.organization) {
        setOrganization(result.organization);
        setName(result.organization.name);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateOrganization(organization.id, { name });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to update organization");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-text-tertiary">No organization found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Settings"
        description="Manage your organization name and general settings."
        purpose="Configure your organization's basic information."
        relatedPages={[
          { label: "Members", href: "/app/settings/members" },
          { label: "Security", href: "/app/settings/security" },
        ]}
      />

      {/* Organization Name */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Organization Name
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="org-name"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              Name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
              placeholder="Enter organization name"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || name === organization.name}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save Changes
            </button>

            {success && (
              <span className="text-sm text-success">Changes saved successfully</span>
            )}
            {error && <span className="text-sm text-error">{error}</span>}
          </div>
        </div>
      </div>

      {/* Organization Details */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Organization Details
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-text-tertiary">Organization ID</span>
            <p className="text-sm text-text-primary font-mono mt-1">
              {organization.id}
            </p>
          </div>
          <div>
            <span className="text-sm text-text-tertiary">Slug</span>
            <p className="text-sm text-text-primary font-mono mt-1">
              {organization.slug}
            </p>
          </div>
          <div>
            <span className="text-sm text-text-tertiary">Members</span>
            <p className="text-sm text-text-primary mt-1">
              {organization.memberCount}
            </p>
          </div>
          <div>
            <span className="text-sm text-text-tertiary">Projects</span>
            <p className="text-sm text-text-primary mt-1">
              {organization.projectCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
