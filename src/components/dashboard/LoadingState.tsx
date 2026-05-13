interface LoadingStateProps {
  lines?: number;
  label?: string;
}

export const LoadingState = ({ lines = 3, label }: LoadingStateProps) => (
  <div className="space-y-3" role="status" aria-live="polite">
    {label && <div className="text-xs text-muted-foreground">{label}</div>}
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 animate-pulse rounded bg-muted"
        style={{ width: `${100 - i * 8}%` }}
      />
    ))}
  </div>
);

export const LoadingCards = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="ide-card h-24 animate-pulse" />
    ))}
  </div>
);
