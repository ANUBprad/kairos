"use client";

import { useState, useEffect } from "react";
import { Bot, CheckCircle2, Loader2 } from "lucide-react";

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
  const [selectedProvider, setSelectedProvider] = useState<string>("openai");
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");

  useEffect(() => {
    fetch("/api/ai/settings")
      .then((res) => res.json())
      .then((data: SettingsData) => {
        setSettings(data);
        setSelectedProvider(data.defaultProvider || "openai");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (settings?.providers[selectedProvider]?.models?.length) {
      setSelectedModel(settings.providers[selectedProvider].models[0]);
    }
  }, [selectedProvider, settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure your AI provider and model preferences.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary mb-4">
            <Bot size={20} />
            AI Provider
          </h2>

          <div className="space-y-3">
            {settings?.providers &&
              Object.entries(settings.providers).map(([key, info]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedProvider === key
                      ? "border-brand bg-brand/5"
                      : "border-border hover:bg-surface-hover"
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={key}
                    checked={selectedProvider === key}
                    onChange={() => setSelectedProvider(key)}
                    className="sr-only"
                  />
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selectedProvider === key
                        ? "border-brand bg-brand"
                        : "border-text-tertiary"
                    }`}
                  >
                    {selectedProvider === key && (
                      <CheckCircle2 size={14} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary capitalize">
                      {key}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {info.available
                        ? "Configured in environment"
                        : "Not configured — add API key to .env.local"}
                    </p>
                  </div>
                  {info.available && (
                    <span className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Ready
                    </span>
                  )}
                </label>
              ))}
          </div>
        </div>

        {settings?.providers[selectedProvider]?.models && (
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Default Model
            </h2>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              {settings.providers[selectedProvider].models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-text-tertiary">
              API keys are stored server-side in environment variables and are
              never exposed to the browser.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Environment Status
          </h2>
          <div className="space-y-2">
            {Object.entries(settings?.providers || {}).map(([key, info]) => (
              <div
                key={key}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm text-text-primary capitalize">{key}</span>
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
