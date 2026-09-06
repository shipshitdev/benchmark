/**
 * Pure formatting helpers. No I/O, no schema parsing — see lib/data.ts for the boundary that
 * produces the typed values these functions render.
 */

/** `1234` -> `"1,234"`, `1_234_000` -> `"1.2M"`, `45_000` -> `"45K"`. */
export function formatTokens(value: number | null): string {
  if (value === null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimZero((value / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${trimZero((value / 1_000).toFixed(1))}K`;
  return value.toLocaleString('en-US');
}

function trimZero(text: string): string {
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

/** `1.234` -> `"$1.23"`. Null means the cost is unknown (missing token telemetry or price). */
export function formatCost(value: number | null): string {
  if (value === null) return '—';
  if (value < 0.01 && value > 0) return `<$0.01`;
  return `$${value.toFixed(2)}`;
}

/** `724_000` (ms) -> `"12m 04s"`. Sub-minute durations render as `"34s"`. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** `0..100` score, one decimal, or an em dash when the run set produced no score. */
export function formatScore(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

/** `1234` (int, tokens/turns/calls) with thousands separators, or an em dash when unknown. */
export function formatCount(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US');
}

/** score / cost, formatted for the "score per $" column. */
export function formatScorePerDollar(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  'ux-ui': 'UX/UI',
  taste: 'Taste',
  frontend: 'Frontend',
  backend: 'Backend',
  'planning-audit': 'Planning Audit',
  bugfix: 'Bug Fix',
  signature: 'Signature',
};

export function formatCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Human label for an agent spec, e.g. `claude:fable@high` -> `"claude · fable · high"`. */
export function formatAgentLabel(agent: { cli: string; model: string; effort?: string }): string {
  return agent.effort
    ? `${agent.cli} · ${agent.model} · ${agent.effort}`
    : `${agent.cli} · ${agent.model}`;
}

export function pctLabel(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
