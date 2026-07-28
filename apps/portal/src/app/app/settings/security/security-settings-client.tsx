"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Key,
  Smartphone,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
export function SecuritySettingsClient() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, []);

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
        title="Security"
        description="Manage your account security settings."
        purpose="Configure authentication and access controls."
        relatedPages={[
          { label: "API Keys", href: "/app/settings/api-keys" },
          { label: "Members", href: "/app/settings/members" },
        ]}
      />

      {/* Password */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Lock size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">
              Password
            </h3>
            <p className="text-xs text-text-tertiary mt-1">
              Manage your password and authentication method.
            </p>
            <button className="mt-3 px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover transition-colors">
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Smartphone size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">
              Two-Factor Authentication
            </h3>
            <p className="text-xs text-text-tertiary mt-1">
              Add an extra layer of security to your account.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-hover text-text-tertiary">
                Not enabled
              </span>
              <button className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover transition-colors">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Key Security */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Key size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">
              API Key Security
            </h3>
            <p className="text-xs text-text-tertiary mt-1">
              Configure API key expiration and rotation policies.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  Default key expiration
                </span>
                <span className="text-xs text-text-primary">90 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  Max keys per user
                </span>
                <span className="text-xs text-text-primary">10</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Shield size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">
              Active Sessions
            </h3>
            <p className="text-xs text-text-tertiary mt-1">
              Manage your active sessions across devices.
            </p>
            <div className="mt-3">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-hover">
                <div className="h-2 w-2 rounded-full bg-success" />
                <div className="flex-1">
                  <p className="text-xs text-text-primary">Current session</p>
                  <p className="text-[10px] text-text-tertiary">
                    Last active: Just now
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
