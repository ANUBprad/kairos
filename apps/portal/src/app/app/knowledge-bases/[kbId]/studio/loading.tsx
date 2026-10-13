export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-3">
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="h-7 w-40 rounded bg-surface" />
        <div className="h-3 w-2/3 rounded bg-surface" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="h-5 w-48 rounded bg-bg-secondary" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-md bg-bg-secondary" />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded-md bg-bg-secondary" />
          ))}
        </div>
        <div className="mt-2 h-4 w-36 rounded bg-bg-secondary" />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="h-5 w-24 rounded bg-bg-secondary" />
          <div className="h-4 w-16 rounded bg-bg-secondary" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-bg-secondary" />
              <div className="h-3 w-24 rounded bg-bg-secondary" />
            </div>
            <div className="h-8 w-24 rounded bg-bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}