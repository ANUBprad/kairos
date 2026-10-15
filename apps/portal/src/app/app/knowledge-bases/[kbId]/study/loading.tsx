export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-3">
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="h-7 w-40 rounded bg-surface" />
        <div className="h-3 w-2/3 rounded bg-surface" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="h-3 w-28 rounded bg-bg-secondary" />
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-bg-secondary" />
            <div className="h-3 w-32 rounded bg-bg-secondary" />
          </div>
          <div className="h-8 w-28 rounded bg-bg-secondary" />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface p-5">
              <div className="h-3 w-20 rounded bg-bg-secondary" />
              <div className="mt-3 h-6 w-12 rounded bg-bg-secondary" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="h-5 w-24 rounded bg-bg-secondary" />
            <div className="h-4 w-16 rounded bg-bg-secondary" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-b-0">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-bg-secondary" />
                <div className="h-3 w-24 rounded bg-bg-secondary" />
              </div>
              <div className="h-8 w-24 rounded bg-bg-secondary" />
            </div>
          ))}
        </div>

        <div className="self-start overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <div className="h-5 w-28 rounded bg-bg-secondary" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0">
              <div className="h-3 w-28 rounded bg-bg-secondary" />
              <div className="h-5 w-10 rounded bg-bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
