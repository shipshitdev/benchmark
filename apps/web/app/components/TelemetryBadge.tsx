const LABEL: Record<string, string> = {
  full: 'full telemetry',
  partial: 'partial telemetry',
  none: 'no telemetry',
};
const CLASS: Record<string, string> = {
  full: 'text-good border-good/40',
  partial: 'text-accent border-accent/40',
  none: 'text-text-faint border-border-strong',
};

export function TelemetryBadge({ telemetry }: { telemetry: 'full' | 'partial' | 'none' }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${CLASS[telemetry]}`}
    >
      {LABEL[telemetry]}
    </span>
  );
}
