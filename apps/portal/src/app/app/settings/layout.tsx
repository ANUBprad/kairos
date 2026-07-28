"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  Shield,
  Key,
  Users,
  Activity,
  Bell,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const settingsTabs = [
  { label: "General", href: "/app/settings", icon: Settings },
  { label: "Organization", href: "/app/settings/organization", icon: Building2 },
  { label: "Members", href: "/app/settings/members", icon: Users },
  { label: "Security", href: "/app/settings/security", icon: Shield },
  { label: "API Keys", href: "/app/settings/api-keys", icon: Key },
  { label: "Notifications", href: "/app/settings/notifications", icon: Bell },
  { label: "Audit Logs", href: "/app/settings/audit", icon: Activity },
];

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Manage your organization, members, and security settings.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="lg:w-56 shrink-0">
          <div className="rounded-xl border border-border bg-surface p-2">
            {settingsTabs.map((tab) => {
              const isActive =
                pathname === tab.href ||
                (tab.href !== "/app/settings" && pathname.startsWith(tab.href));

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-brand/10 text-brand font-medium"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  )}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
