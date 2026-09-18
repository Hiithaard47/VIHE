export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-4 w-40 animate-pulse rounded bg-hairline" />
      <div className="h-28 animate-pulse rounded-lg border border-hairline bg-card" />
      <div className="h-28 animate-pulse rounded-lg border border-hairline bg-card" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
