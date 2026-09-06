const LABEL: Record<string, string> = {
  full: 'full',
  partial: 'partial',
  none: 'none',
};
const CLASS: Record<string, string> = {
  full: 'text-good border-good/40',
  partial: 'text-accent border-accent/40',
  none: 'text-text-faint border-border-strong',
};

export function TelemetryBadge({ telemetry }: { telemetry: 'full' | 'partial' | 'none' }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${CLASS[telemetry]}`}
      title={`${LABEL[telemetry]} telemetry`}
    >
      {LABEL[telemetry]}
    </span>
  );
}
