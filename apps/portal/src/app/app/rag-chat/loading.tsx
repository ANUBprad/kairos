export default function Loading() {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      <div className="h-8 bg-surface rounded w-1/3" />
      <div className="h-4 bg-surface rounded w-2/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-surface rounded-lg" />
        ))}
      </div>
    </div>
  );
}
