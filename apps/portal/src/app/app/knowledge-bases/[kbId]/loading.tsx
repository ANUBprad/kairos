export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-48 rounded-lg bg-surface" />
        <div className="mt-2 h-4 w-32 rounded bg-surface" />
      </div>
      <div className="mb-4 h-10 w-72 rounded-[10px] border border-border bg-bg" />
      <div className="rounded-xl border border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0"
          >
            <div className="h-8 w-8 rounded-lg bg-surface" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded bg-surface" />
              <div className="h-3 w-24 rounded bg-surface/50" />
            </div>
            <div className="h-5 w-16 rounded-[8px] bg-surface" />
            <div className="h-8 w-8 rounded-lg bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
