"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  Loader2,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
interface NotificationPreference {
  type: string;
  label: string;
  description: string;
  email: boolean;
  inApp: boolean;
}

export function NotificationsSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      type: "experiment.completed",
      label: "Experiment Completed",
      description: "When an experiment finishes running",
      email: true,
      inApp: true,
    },
    {
      type: "experiment.failed",
      label: "Experiment Failed",
      description: "When an experiment fails to complete",
      email: true,
      inApp: true,
    },
    {
      type: "upload.completed",
      label: "Upload Completed",
      description: "When a document upload is processed",
      email: false,
      inApp: true,
    },
    {
      type: "upload.failed",
      label: "Upload Failed",
      description: "When a document upload fails",
      email: true,
      inApp: true,
    },
    {
      type: "invitation.received",
      label: "Invitation Received",
      description: "When you receive an organization invitation",
      email: true,
      inApp: true,
    },
    {
      type: "member.joined",
      label: "Member Joined",
      description: "When a new member joins your organization",
      email: false,
      inApp: true,
    },
    {
      type: "permission.updated",
      label: "Permission Updated",
      description: "When your role or permissions change",
      email: true,
      inApp: true,
    },
  ]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleToggle = (type: string, channel: "email" | "inApp") => {
    setPreferences((prev) =>
      prev.map((p) =>
        p.type === type ? { ...p, [channel]: !p[channel] } : p
      )
    );
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
        title="Notifications"
        description="Configure how you receive notifications."
        purpose="Manage email and in-app notification preferences."
        relatedPages={[
          { label: "Security", href: "/app/settings/security" },
          { label: "Members", href: "/app/settings/members" },
        ]}
      />

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Notification Preferences
        </h2>

        {/* Header */}
        <div className="flex items-center gap-4 mb-3 pb-2 border-b border-border">
          <div className="flex-1">
            <span className="text-xs font-medium text-text-tertiary">Event</span>
          </div>
          <div className="w-20 text-center">
            <Mail size={14} className="mx-auto text-text-tertiary" />
            <span className="text-[10px] text-text-tertiary block">Email</span>
          </div>
          <div className="w-20 text-center">
            <Bell size={14} className="mx-auto text-text-tertiary" />
            <span className="text-[10px] text-text-tertiary block">In-App</span>
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-2">
          {preferences.map((pref) => (
            <div
              key={pref.type}
              className="flex items-center gap-4 py-2"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">
                  {pref.label}
                </p>
                <p className="text-xs text-text-tertiary">{pref.description}</p>
              </div>

              <div className="w-20 flex justify-center">
                <button
                  onClick={() => handleToggle(pref.type, "email")}
                  className={`h-6 w-10 rounded-full transition-colors relative ${
                    pref.email ? "bg-brand" : "bg-surface-hover"
                  }`}
                >
                  <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      pref.email ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="w-20 flex justify-center">
                <button
                  onClick={() => handleToggle(pref.type, "inApp")}
                  className={`h-6 w-10 rounded-full transition-colors relative ${
                    pref.inApp ? "bg-brand" : "bg-surface-hover"
                  }`}
                >
                  <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      pref.inApp ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors">
            <Check size={14} />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
