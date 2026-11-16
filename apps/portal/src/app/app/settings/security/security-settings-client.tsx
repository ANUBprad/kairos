"use client";

import Link from "next/link";
import { Shield, Lock, Key, Smartphone, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

interface Props {
  email: string | null;
  isAnonymous: boolean;
  maxKeys: number;
}

// This page reports the controls the deployment actually enforces. It used to
// show "Change Password" / "Enable 2FA" buttons and a fake 500ms spinner, but
// none of those buttons had a handler and the API key limits were invented.
export function SecuritySettingsClient({ email, isAnonymous, maxKeys }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="The authentication and API key controls this deployment enforces."
        purpose="Review real account security facts instead of toggles that do not persist."
        relatedPages={[
          { label: "API Keys", href: "/app/settings/api-keys" },
          { label: "Members", href: "/app/settings/members" },
        ]}
      />

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <UserRound size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary">Account</h2>
            <p className="mt-1 text-xs text-text-tertiary">
              {email ? `Signed in as ${email}.` : "No active session."}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {isAnonymous
                ? "This is a guest account. Create an account to keep your workspaces when you change devices."
                : "This is a registered account."}
            </p>
            {isAnonymous && (
              <Link
                href="/signup"
                className="mt-3 inline-flex rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
              >
                Create an account
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <Lock size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary">Password</h2>
            <p className="mt-1 text-xs text-text-tertiary">
              {isAnonymous
                ? "Guest accounts have no password. Sign up with an email and password to enable password sign-in."
                : "Password sign-in is managed by Better Auth. In-app password changes are not implemented yet, so this page does not offer a button that cannot work."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <Smartphone size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary">
              Two-Factor Authentication
            </h2>
            <p className="mt-1 text-xs text-text-tertiary">
              Not enabled. This deployment does not include a two-factor provider, so
              accounts are protected by their sign-in method and session cookie only.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <Key size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary">API Key Security</h2>
            <dl className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-xs text-text-tertiary">Max active keys per user</dt>
                <dd className="text-xs text-text-primary">{maxKeys}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-text-tertiary">Default key expiration</dt>
                <dd className="text-xs text-text-primary">
                  Chosen per key (optional)
                </dd>
              </div>
            </dl>
            <Link
              href="/app/settings/api-keys"
              className="mt-3 inline-flex rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
            >
              Manage API keys
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <Shield size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary">Sessions</h2>
            <p className="mt-1 text-xs text-text-tertiary">
              Better Auth stores one session cookie per browser. This deployment does
              not expose a session list, so there is no per-device session table here.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
