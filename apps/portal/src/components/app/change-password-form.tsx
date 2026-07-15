"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth-client";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      if (authError) {
        setError(authError.message || "Failed to change password");
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success flex items-center gap-2">
        <CheckCircle2 size={16} />
        Password updated successfully.
      </div>
    );
  }

  return (
    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          minLength={8}
          className="w-full h-11 rounded-lg border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
        />
      </div>
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          minLength={8}
          className="w-full h-11 rounded-lg border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        className="h-11 text-[13px]"
        disabled={loading}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        Update password
      </Button>
    </form>
  );
}
