import type { ModelPrice, UsageTotals } from '@benchmark/schema';
import { formatCost, formatTokens } from '@/lib/format';

type TokenClass = {
  key: 'input' | 'cacheRead' | 'cacheWrite' | 'output';
  label: string;
  color: string;
};

const CLASSES: TokenClass[] = [
  { key: 'input', label: 'Input', color: 'var(--color-accent)' },
  { key: 'cacheRead', label: 'Cache read', color: 'var(--color-text-dim)' },
  { key: 'cacheWrite', label: 'Cache write', color: 'var(--color-bad)' },
  { key: 'output', label: 'Output', color: 'var(--color-good)' },
];

/** Stacked bar sized by dollar contribution per token class (not token count) — the point is
 *  showing where the API-equivalent cost actually went, with token counts as the supporting
 *  numbers next to each segment. Null when the agent's model has no price table entry. */
export function TokenCostBar({
  usage,
  price,
}: {
  usage: UsageTotals;
  price: ModelPrice | undefined;
}) {
  if (!price) {
    return (
      <p className="text-sm text-text-faint">
        No price table entry for this model — cost by class is unknown.
      </p>
    );
  }

  const perToken = (tokens: number | null, perMillion: number | null) =>
    tokens !== null && perMillion !== null ? (tokens * perMillion) / 1_000_000 : 0;

  const segments = CLASSES.map((c) => ({
    ...c,
    tokens: usage[c.key],
    cost: perToken(usage[c.key], price[c.key]),
  })).filter((s) => s.tokens !== null && s.tokens > 0);

  const totalCost = segments.reduce((sum, s) => sum + s.cost, 0);
  if (totalCost === 0) {
    return <p className="text-sm text-text-faint">No token cost recorded for this agent yet.</p>;
  }

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded">
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.cost / totalCost) * 100}%`, background: s.color }}
            title={`${s.label}: ${formatTokens(s.tokens)} tokens, ${formatCost(s.cost)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-text-dim">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: s.color }}
            />
            {s.label} <span className="tabular text-text-faint">{formatTokens(s.tokens)}</span>{' '}
            <span className="tabular text-text">{formatCost(s.cost)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
