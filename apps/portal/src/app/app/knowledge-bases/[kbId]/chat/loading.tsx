export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-3">
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="h-7 w-40 rounded bg-surface" />
        <div className="h-3 w-2/3 rounded bg-surface" />
      </div>

      <div className="flex h-[calc(100dvh-16rem)] min-h-[28rem] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        <div className="hidden w-72 shrink-0 border-r border-border p-4 lg:block">
          <div className="h-9 w-full rounded bg-bg-secondary" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-bg-secondary" />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="h-12 shrink-0 border-b border-border" />
          <div className="flex-1 space-y-8 p-6">
            <div className="ml-auto h-10 w-1/2 rounded-lg bg-bg-secondary" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-bg-secondary" />
              <div className="h-3 w-11/12 rounded bg-bg-secondary" />
              <div className="h-3 w-4/5 rounded bg-bg-secondary" />
            </div>
          </div>
          <div className="h-16 shrink-0 border-t border-border" />
        </div>
      </div>
    </div>
  );
}
