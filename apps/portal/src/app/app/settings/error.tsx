"use client";

export default function SettingsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary">Settings Error</h2>
        <p className="mt-2 text-sm text-text-secondary">{error.message || "Failed to load settings"}</p>
        <button onClick={reset} className="mt-4 px-4 py-2 rounded-lg bg-brand text-white text-sm hover:bg-brand/90">
          Try Again
        </button>
      </div>
    </div>
  );
}