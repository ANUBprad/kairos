"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2, Puzzle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { GithubIcon } from "@/components/ui/github-icon";
import {
  GoogleDriveIcon,
  NotionIcon,
} from "@/components/ui/integration-brand-icons";
import { IntegrationCard } from "./integration-card";
import { integrationErrorFromQuery } from "../lib/integration-callback";

interface IntegrationsStatus {
  googleDrive: {
    connected: boolean;
    needsReconnect?: boolean;
    account?: {
      metadata?: { email?: string; name?: string };
      createdAt?: string;
    } | null;
  };
  notion: {
    connected: boolean;
    needsReconnect?: boolean;
    account?: {
      metadata?: { workspaceName?: string; avatarUrl?: string };
      createdAt?: string;
    } | null;
  };
  github: {
    connected: boolean;
    needsReconnect?: boolean;
    account?: {
      metadata?: { login?: string; name?: string; avatarUrl?: string };
      createdAt?: string;
    } | null;
  };
}

type IntegrationsSettingsViewProps = {
  workspaceId?: string;
};

const actionBtnPrimary =
  "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90 disabled:opacity-50 motion-reduce:transition-none";
const actionBtnDanger =
  "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-transparent px-3 py-2.5 text-xs font-medium text-danger transition-colors hover:border-danger/20 hover:bg-danger/10 disabled:opacity-50 motion-reduce:transition-none";

export function IntegrationsSettingsView({
  workspaceId,
}: IntegrationsSettingsViewProps) {
  const queryClient = useQueryClient();
  const [notionToken, setNotionToken] = useState("");
  const [notionError, setNotionError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [callbackError, setCallbackError] = useState(() =>
    typeof window === "undefined"
      ? null
      : integrationErrorFromQuery(new URLSearchParams(window.location.search)),
  );
  const googleMessage =
    callbackError?.provider === "googleDrive" ? callbackError.message : googleError;
  const githubMessage =
    callbackError?.provider === "github" ? callbackError.message : githubError;

  const { data: integrations, isLoading } = useQuery<IntegrationsStatus>({
    queryKey: ["connected-integrations"],
    queryFn: () => apiClient<IntegrationsStatus>("/api/integrations"),
  });

  const connectNotionMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiClient("/api/integrations/notion/connect", {
        method: "POST",
        body: JSON.stringify({ token: token.trim() }),
      });
    },
    onSuccess: () => {
      setNotionToken("");
      setNotionError(null);
      void queryClient.invalidateQueries({ queryKey: ["connected-integrations"] });
    },
    onError: (err: unknown) => {
      setNotionError(err instanceof Error ? err.message : "Failed to connect Notion.");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: "google-drive" | "notion" | "github") => {
      return await apiClient(`/api/integrations/${provider}`, { method: "DELETE" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connected-integrations"] });
    },
  });

  const handleConnectGoogleDrive = async () => {
    setGoogleError(null);
    setCallbackError(null);
    try {
      const res = await apiClient<{ url: string }>(
        "/api/integrations/google-drive/auth-url",
      );
      if (res.url) window.location.href = res.url;
    } catch (err: unknown) {
      setGoogleError(
        err instanceof Error ? err.message : "Failed to get Google Drive auth URL.",
      );
    }
  };

  const handleConnectGithub = async () => {
    setGithubError(null);
    setCallbackError(null);
    try {
      const res = await apiClient<{ url: string }>(
        "/api/integrations/github/auth-url",
      );
      if (res.url) window.location.href = res.url;
    } catch (err: unknown) {
      setGithubError(
        err instanceof Error ? err.message : "Failed to get GitHub auth URL.",
      );
    }
  };

  const accountBoxClass = "kairos-inset space-y-0.5 px-3 py-2.5 text-xs";

  const cards = isLoading ? (
    <div className="kairos-panel flex min-h-72 items-center justify-center">
      <ThemeLoader size={28} />
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-stretch">
      <IntegrationCard
        title="Google Drive"
        description="Connect Drive to bring Google Docs and PDFs into your Kairos library."
        connected={!!integrations?.googleDrive?.connected}
        icon={<GoogleDriveIcon size={34} />}
        iconClassName="bg-muted/30"
        footer={
          integrations?.googleDrive?.connected ? (
            <button
              type="button"
              onClick={() => disconnectMutation.mutate("google-drive")}
              disabled={disconnectMutation.isPending}
              className={actionBtnDanger}
            >
              <Trash2 className="size-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogleDrive}
              className={actionBtnPrimary}
            >
              {integrations?.googleDrive?.needsReconnect
                ? "Reconnect Google Drive"
                : "Connect Google Drive"}
              <ExternalLink className="size-3.5" />
            </button>
          )
        }
      >
        {googleMessage && (
          <div role="alert"
            className="rounded-xl border border-danger/20 bg-danger/5 p-2.5 text-xs text-danger">
            {googleMessage}
          </div>
        )}
        {integrations?.googleDrive?.connected ? (
          <div className={accountBoxClass}>
            <p className="font-medium text-foreground truncate">
              {integrations.googleDrive.account?.metadata?.name || "Google Account"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono truncate">
              {integrations.googleDrive.account?.metadata?.email}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {integrations?.googleDrive?.needsReconnect
              ? "Your saved Google Drive authorization is no longer usable. Reconnect to browse files again."
              : "Connect Google Drive to choose Docs and PDFs when adding sources."}
          </p>
        )}
      </IntegrationCard>

      <IntegrationCard
        title="Notion"
        description="Connect a Notion integration to import pages into your Kairos library."
        connected={!!integrations?.notion?.connected}
        icon={<NotionIcon size={24} />}
        iconClassName="bg-muted/30"
        footer={
          integrations?.notion?.connected ? (
            <button
              type="button"
              onClick={() => disconnectMutation.mutate("notion")}
              disabled={disconnectMutation.isPending}
              className={actionBtnDanger}
            >
              <Trash2 className="size-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => connectNotionMutation.mutate(notionToken)}
              disabled={connectNotionMutation.isPending || !notionToken.trim()}
              className={actionBtnPrimary}
            >
              {connectNotionMutation.isPending ? (
                <ThemeLoader size={14} />
              ) : (
                "Connect Notion"
              )}
            </button>
          )
        }
      >
        {notionError && (
          <div role="alert"
            className="rounded-xl border border-danger/20 bg-danger/5 p-2.5 text-xs text-danger">
            {notionError}
          </div>
        )}
        {integrations?.notion?.connected ? (
          <div className={accountBoxClass}>
            <p className="font-medium text-foreground truncate">
              {integrations.notion.account?.metadata?.workspaceName ||
                "Connected workspace"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Connection active
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="notion-integration-token"
              className="block text-[11px] font-medium text-foreground"
            >
              Integration secret
            </label>
            <input
              id="notion-integration-token"
              type="password"
              placeholder="secret_…"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            />
            <p className="text-[10px] text-muted-foreground">
              Create at{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline decoration-brand/40 underline-offset-2 hover:text-brand"
              >
                notion.so/my-integrations
              </a>
            </p>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        title="GitHub"
        description="Connect GitHub to use repositories as grounded chat sources."
        connected={!!integrations?.github?.connected}
        icon={<GithubIcon size={22} />}
        footer={
          integrations?.github?.connected ? (
            <button
              type="button"
              onClick={() => disconnectMutation.mutate("github")}
              disabled={disconnectMutation.isPending}
              className={actionBtnDanger}
            >
              <Trash2 className="size-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectGithub}
              className={actionBtnPrimary}
            >
              {integrations?.github?.needsReconnect
                ? "Reconnect GitHub"
                : "Connect GitHub"}
              <ExternalLink className="size-3.5" />
            </button>
          )
        }
      >
        {githubMessage && (
          <div role="alert"
            className="rounded-xl border border-danger/20 bg-danger/5 p-2.5 text-xs text-danger">
            {githubMessage}
          </div>
        )}
        {integrations?.github?.connected ? (
          <div className={accountBoxClass}>
            <p className="font-medium text-foreground truncate">
              {integrations.github.account?.metadata?.name || "GitHub account"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono truncate">
              @{integrations.github.account?.metadata?.login}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {integrations?.github?.needsReconnect
              ? "Your saved GitHub authorization was revoked or expired. Reconnect to browse repositories again."
              : "OAuth connects your account so you can choose repositories as sources."}
          </p>
        )}
      </IntegrationCard>
    </div>
  );

  const body = (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl">
        <p className="kairos-eyebrow">Connections</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="kairos-inset flex size-10 shrink-0 items-center justify-center text-primary">
            <Puzzle className="size-5" />
          </span>
          <h1 className="kairos-section-title text-2xl text-foreground sm:text-3xl">
            Integrations
          </h1>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Review the accounts saved to your Kairos profile and add sources from the
          tools you already use. A connection is shown only when its authorization
          is still usable; expired or revoked access asks you to reconnect.
        </p>
      </div>
      {cards}
    </div>
  );

  if (workspaceId) {
    return body;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3.5 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <span className="kairos-eyebrow">Integrations</span>
      </div>
      {body}
    </div>
  );
}
