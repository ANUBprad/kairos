"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth-client";
import { trackEvent } from "@/lib/telemetry/analytics";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface UsageData {
  plan: string;
  period: string;
  knowledgeBases: { current: number; limit: number };
  documents: { current: number; limit: number };
  aiChats: { current: number; limit: number };
  uploads: { current: number; limit: number };
  storageMB: { current: number; limit: number };
  agents: { current: number; limit: number };
  credits: { current: number; limit: number };
}

interface ReferralStats {
  code: string;
  invites: number;
  signups: number;
  conversions: number;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function AccountClient() {
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "true";
  const [tab, setTab] = useState<"profile" | "security" | "billing" | "usage" | "keys" | "referrals" | "notifications">("profile");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [referrals, setReferrals] = useState<ReferralStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === "keys") fetchKeys();
    if (tab === "usage") fetchUsage();
    if (tab === "referrals") fetchReferrals();
    if (tab === "notifications") fetchNotifications();
  }, [tab]);

  async function fetchKeys() {
    const res = await fetch("/api/keys");
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys);
    }
  }

  async function fetchUsage() {
    const res = await fetch("/api/billing/usage");
    if (res.ok) {
      const data = await res.json();
      setUsage(data);
    }
  }

  async function fetchReferrals() {
    const res = await fetch("/api/referrals");
    if (res.ok) {
      const data = await res.json();
      setReferrals(data);
    }
  }

  async function fetchNotifications() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.key.rawKey);
      setNewKeyName("");
      trackEvent("api_key_created");
      fetchKeys();
    }
    setLoading(false);
  }

  async function deleteKey(keyId: string) {
    await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    fetchKeys();
  }

  async function markRead(ids?: string[]) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    fetchNotifications();
  }

  async function handleSignOut() {
    await authClient.signOut();
    trackEvent("user_logged_out");
    window.location.href = "/login";
  }

  const tabs = [
    { id: "profile" as const, label: "Profile" },
    { id: "security" as const, label: "Security" },
    { id: "billing" as const, label: "Billing" },
    { id: "usage" as const, label: "Usage" },
    { id: "keys" as const, label: "API Keys" },
    { id: "referrals" as const, label: "Referrals" },
    { id: "notifications" as const, label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {upgraded && (
        <div className="rounded-[var(--radius-xl)] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-600">
          Your plan has been upgraded! Changes are effective immediately.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Account Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your account, billing, and API keys</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? "border-b-2 border-brand text-brand"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="space-y-4">
          <Card title="Profile">
            <p className="text-sm text-text-secondary">Manage your account profile and preferences.</p>
            <Button variant="secondary" onClick={handleSignOut} className="mt-4">
              Sign Out
            </Button>
          </Card>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-4">
          <Card title="Security">
            <p className="text-sm text-text-secondary mb-4">Your account is secured with email/password and optional GitHub OAuth.</p>
            <Button variant="secondary" onClick={() => window.location.href = "/app/settings"}>
              Change Password
            </Button>
          </Card>
        </div>
      )}

      {tab === "billing" && (
        <div className="space-y-4">
          <Card title="Subscription">
            <p className="text-sm text-text-secondary mb-4">Manage your subscription and billing.</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={async () => {
                const res = await fetch("/api/stripe/portal", { method: "POST" });
                if (res.ok) {
                  const data = await res.json();
                  window.location.href = data.url;
                }
              }}>
                Manage Billing
              </Button>
              <Button variant="primary" onClick={() => window.location.href = "/pricing"}>
                View Plans
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "usage" && (
        <div className="space-y-4">
          <Card title="Current Usage">
            {usage ? (
              <div className="space-y-3">
                <UsageRow label="Credits" current={usage.credits.current} limit={usage.credits.limit} />
                <UsageRow label="Knowledge Bases" current={usage.knowledgeBases.current} limit={usage.knowledgeBases.limit} />
                <UsageRow label="Documents" current={usage.documents.current} limit={usage.documents.limit} />
                <UsageRow label="AI Chats" current={usage.aiChats.current} limit={usage.aiChats.limit} />
                <UsageRow label="Uploads Today" current={usage.uploads.current} limit={usage.uploads.limit} />
                <UsageRow label="Storage" current={usage.storageMB.current} limit={usage.storageMB.limit} unit="MB" />
                <UsageRow label="Agents" current={usage.agents.current} limit={usage.agents.limit} />
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">Loading...</p>
            )}
          </Card>
        </div>
      )}

      {tab === "keys" && (
        <div className="space-y-4">
          <Card title="API Keys">
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name"
                className="flex-1 rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
              />
              <Button onClick={createKey} disabled={loading || !newKeyName.trim()}>
                Generate Key
              </Button>
            </div>

            {newKey && (
              <div className="rounded-[var(--radius-lg)] border border-amber-500/30 bg-amber-500/5 p-3 mb-4">
                <p className="text-xs text-amber-600 font-medium mb-1">Your API key (copy it now — it won&apos;t be shown again):</p>
                <code className="text-xs text-text-primary break-all">{newKey}</code>
              </div>
            )}

            {keys.length === 0 ? (
              <p className="text-sm text-text-tertiary">No API keys yet.</p>
            ) : (
              <div className="space-y-2">
                {keys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{key.name}</p>
                      <p className="text-xs text-text-tertiary">
                        {key.keyPrefix}... • Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteKey(key.id)}>
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "referrals" && (
        <div className="space-y-4">
          <Card title="Referral Program">
            <p className="text-sm text-text-secondary mb-4">
              Invite friends and earn AI credits when they subscribe.
            </p>
            {referrals ? (
              <div className="space-y-4">
                <div className="rounded-[var(--radius-lg)] border border-border p-4">
                  <p className="text-xs text-text-tertiary mb-1">Your Referral Code</p>
                  <p className="text-lg font-mono font-bold text-brand">{referrals.code}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[var(--radius-lg)] border border-border p-3">
                    <p className="text-2xl font-bold text-text-primary">{referrals.invites}</p>
                    <p className="text-xs text-text-tertiary">Invites</p>
                  </div>
                  <div className="rounded-[var(--radius-lg)] border border-border p-3">
                    <p className="text-2xl font-bold text-text-primary">{referrals.signups}</p>
                    <p className="text-xs text-text-tertiary">Signups</p>
                  </div>
                  <div className="rounded-[var(--radius-lg)] border border-border p-3">
                    <p className="text-2xl font-bold text-text-primary">{referrals.conversions}</p>
                    <p className="text-xs text-text-tertiary">Conversions</p>
                  </div>
                </div>
                <Button variant="secondary" onClick={async () => {
                  const res = await fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "friend@example.com" }) });
                  if (res.ok) {
                    const data = await res.json();
                    navigator.clipboard.writeText(data.url);
                  }
                }}>
                  Copy Invite Link
                </Button>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">Loading...</p>
            )}
          </Card>
        </div>
      )}

      {tab === "notifications" && (
        <div className="space-y-4">
          <Card title="Notifications">
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={() => markRead()} className="mb-4">
                Mark all read
              </Button>
            )}
            {notifications.length === 0 ? (
              <p className="text-sm text-text-tertiary">No notifications.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-[var(--radius-lg)] border p-3 ${n.read ? "border-border bg-surface/50" : "border-brand/30 bg-brand/5"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{n.title}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => markRead([n.id])}
                          className="text-xs text-brand hover:text-brand-hover"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4">{title}</h2>
      {children}
    </div>
  );
}

function UsageRow({ label, current, limit, unit }: { label: string; current: number; limit: number; unit?: string }) {
  const pct = limit === -1 ? 0 : Math.min(100, (current / limit) * 100);
  const isUnlimited = limit === -1;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-tertiary">{label}</span>
        <span className="text-text-primary font-medium">
          {current}{unit ? ` ${unit}` : ""} / {isUnlimited ? "∞" : `${limit}${unit ? ` ${unit}` : ""}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-brand"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
