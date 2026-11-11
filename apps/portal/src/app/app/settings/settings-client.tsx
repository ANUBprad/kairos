"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

interface ProviderInfo {
  available: boolean;
  models: string[];
}

interface SettingsData {
  providers: Record<string, ProviderInfo>;
  defaultProvider: string;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSettings() {
      try {
        const response = await fetch("/api/ai/settings", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Unable to load AI configuration (${response.status})`);
        }
        const data = (await response.json()) as SettingsData;
        setSettings(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadSettings();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const activeProvider = settings?.defaultProvider || "openai";
  const activeProviderInfo = settings?.providers[activeProvider];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader
        title="AI Configuration"
        description="View the AI provider configured for this deployment."
        purpose="Check runtime provider availability and supported models."
        relatedPages={[
          { label: "Architecture", href: "/app/architecture" },
          { label: "Project Guide", href: "/app/project-guide" },
        ]}
      />

      {loadError || !settings ? (
        <div className="rounded-xl border border-border bg-surface p-5 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 text-text-tertiary" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              Configuration unavailable
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              The server configuration could not be loaded. Refresh the page or
              contact the deployment administrator.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Bot size={20} />
              Runtime provider
            </h2>
            <div className="rounded-lg border border-border bg-surface-hover p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium capitalize text-text-primary">
                    {activeProvider}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Selected by the deployment's AI_PROVIDER environment
                    variable.
                  </p>
                </div>
                {activeProviderInfo?.available ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle2 size={13} />
                    Configured
                  </span>
                ) : (
                  <span className="text-xs font-medium text-text-tertiary">
                    Not configured
                  </span>
                )}
              </div>
              {activeProviderInfo?.models.length ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-text-secondary">
                    Supported models
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeProviderInfo.models.map((model) => (
                      <span
                        key={model}
                        className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-text-tertiary">
              Provider and model preferences are deployment-controlled here;
              this page does not save per-user changes. API keys remain
              server-side in environment variables.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Environment status
            </h2>
            <div className="space-y-3">
              {Object.entries(settings.providers).map(([provider, info]) => (
                <div
                  key={provider}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm capitalize text-text-primary">
                    {provider}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      info.available ? "text-success" : "text-text-tertiary"
                    }`}
                  >
                    {info.available ? "API key configured" : "Not configured"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
