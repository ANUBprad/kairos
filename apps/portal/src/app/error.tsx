"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10 mx-auto">
          <span className="text-2xl">!</span>
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Something went wrong</h1>
        <p className="text-sm text-text-secondary">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-text-tertiary font-mono">{error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
