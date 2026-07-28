"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import {
  createNewApiKey,
  listApiKeys,
  deactivateApiKey,
  removeApiKey,
  rotateExistingApiKey,
} from "@/lib/actions/api-keys";
import type { ResourceType } from "@/lib/rbac";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: unknown;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  enabled: boolean;
  createdAt: Date;
}

export function ApiKeysSettingsClient() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiresInDays, setNewKeyExpiresInDays] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setLoading(true);
    try {
      const result = await listApiKeys();
      if (result.success && "apiKeys" in result) {
        setApiKeys(result.apiKeys as ApiKey[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName) return;

    setCreating(true);
    setError(null);

    try {
      const result = await createNewApiKey(
        newKeyName,
        [{ resource: "organization" as ResourceType }],
        newKeyExpiresInDays
      );

      if (result.success && "key" in result) {
        setCreatedKey(result.key || null);
        setNewKeyName("");
        setNewKeyExpiresInDays(undefined);
        await loadApiKeys();
      } else {
        setError(result.error || "Failed to create API key");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeactivate = async (keyId: string) => {
    if (!confirm("Are you sure you want to deactivate this API key?")) return;

    const result = await deactivateApiKey(keyId);
    if (result.success) {
      await loadApiKeys();
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This cannot be undone.")) return;

    const result = await removeApiKey(keyId);
    if (result.success) {
      await loadApiKeys();
    }
  };

  const handleRotate = async (keyId: string) => {
    if (!confirm("Are you sure you want to rotate this API key? The old key will be immediately invalidated.")) return;

    const result = await rotateExistingApiKey(keyId);
    if (result.success) {
      setCreatedKey(result.key || null);
      await loadApiKeys();
    }
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
        title="API Keys"
        description="Manage API keys for programmatic access to the Kairos API."
        purpose="Create and manage API keys for integrations."
        relatedPages={[
          { label: "Security", href: "/app/settings/security" },
          { label: "Organization", href: "/app/settings/organization" },
        ]}
      />

      {/* Created Key Display */}
      {createdKey && (
        <div className="rounded-xl border border-success bg-success/5 p-6">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-success mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-success mb-1">
                API Key Created Successfully
              </h3>
              <p className="text-xs text-text-tertiary mb-3">
                Copy this key now. You won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-bg text-xs font-mono text-text-primary break-all">
                  {createdKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-text-tertiary hover:text-text-secondary"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* API Keys List */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            API Keys ({apiKeys.length})
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            <Plus size={14} />
            Create API Key
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <Key size={24} className="mx-auto text-text-tertiary mb-2" />
            <p className="text-sm text-text-tertiary">No API keys yet</p>
            <p className="text-xs text-text-tertiary mt-1">
              Create an API key to access the Kairos API programmatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border"
              >
                <div className="h-10 w-10 rounded-full bg-surface-hover flex items-center justify-center text-text-tertiary">
                  <Key size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">
                      {apiKey.name}
                    </p>
                    {!apiKey.enabled && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-error/10 text-error">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary font-mono">
                    {apiKey.keyPrefix}...
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {apiKey.lastUsedAt
                      ? `Last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                    {apiKey.expiresAt &&
                      ` · Expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRotate(apiKey.id)}
                    className="p-2 text-text-tertiary hover:text-text-secondary rounded-lg hover:bg-surface-hover transition-colors"
                    title="Rotate key"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => handleDeactivate(apiKey.id)}
                    className="p-2 text-text-tertiary hover:text-warning rounded-lg hover:bg-warning/10 transition-colors"
                    title="Deactivate"
                  >
                    <AlertTriangle size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(apiKey.id)}
                    className="p-2 text-text-tertiary hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  Create API Key
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-text-tertiary hover:text-text-secondary"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
                    placeholder="e.g., CI/CD Pipeline"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Expiration (optional)
                  </label>
                  <select
                    value={newKeyExpiresInDays || ""}
                    onChange={(e) =>
                      setNewKeyExpiresInDays(
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
                  >
                    <option value="">Never expires</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>

                {error && (
                  <p className="text-sm text-error">{error}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newKeyName}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
