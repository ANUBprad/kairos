export default function AppLoading() {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface-hover" />
      <div className="h-4 w-96 rounded-lg bg-surface-hover" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-surface p-4">
            <div className="h-3 w-20 rounded bg-surface-hover mb-3" />
            <div className="h-7 w-16 rounded bg-surface-hover" />
          </div>
        ))}
      </div>
      <div className="h-40 rounded-xl border border-border bg-surface p-5">
        <div className="h-3 w-24 rounded bg-surface-hover mb-4" />
        <div className="flex gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-surface-hover" />
              <div className="h-3 w-16 rounded bg-surface-hover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
