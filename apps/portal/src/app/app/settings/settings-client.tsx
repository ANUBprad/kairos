"use client";

import { useState, useEffect } from "react";
import { Bot, CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

interface ProviderInfo {
  available: boolean;
  models: string[];
}

interface SettingsData {
  providers: Record<string, ProviderInfo>;
  defaultProvider: string;
}

// Provider and model are deployment configuration, not per-user preferences:
// there is no endpoint that persists a selection. This page reports the
// environment values instead of rendering radios and a select that silently
// discarded the user's choice.
export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/settings", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: SettingsData) => {
        setSettings(data);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setSettings({ providers: {}, defaultProvider: "openai" });
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const defaultProvider = settings?.defaultProvider ?? "openai";
  const defaultModels = settings?.providers[defaultProvider]?.models ?? [];

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <PageHeader
        title="Configuration"
        description="AI providers available in this deployment."
        purpose="Show which provider keys the server has and which provider is the default."
        relatedPages={[
          { label: "Architecture", href: "/app/architecture" },
          { label: "Project Guide", href: "/app/project-guide" },
        ]}
      />

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
            <Bot size={20} />
            AI Provider
          </h2>

          <div className="space-y-3">
            {Object.entries(settings?.providers ?? {}).map(([key, info]) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize text-text-primary">
                    {key}
                    {key === defaultProvider && (
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-brand">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {info.available
                      ? "API key configured on the server"
                      : "Not configured — add the API key to the server environment"}
                  </p>
                </div>
                {info.available && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 size={12} />
                    Ready
                  </span>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-text-tertiary">
            Provider and model come from the server environment
            (<code>AI_PROVIDER</code> and the provider API keys). Changing them
            requires updating the deployment; this page does not store per-user
            overrides.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Default Model
          </h2>
          <p className="text-sm text-text-primary">
            {defaultModels[0] ?? "No model list available for the default provider."}
          </p>
          <p className="mt-2 text-xs text-text-tertiary">
            The default provider&apos;s first model is used when a request does not
            name one. Available models: {defaultModels.join(", ") || "none"}.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Environment Status
          </h2>
          <div className="space-y-2">
            {Object.entries(settings?.providers ?? {}).map(([key, info]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-sm capitalize text-text-primary">{key}</span>
                <span
                  className={`text-xs font-medium ${
                    info.available ? "text-success" : "text-text-tertiary"
                  }`}
                >
                  {info.available ? "Configured" : "Not configured"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
