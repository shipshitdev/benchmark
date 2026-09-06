import type { Spread } from '@benchmark/schema';
import { formatScore } from '@/lib/format';

/** Renders a 0..100 spread (min/mean/max over n runs) as a horizontal band — the mean sits on a
 *  track spanning min to max, so a reader sees both the score and how much it moved run to run. */
export function SpreadBand({ spread }: { spread: Spread | null }) {
  if (!spread) return <span className="text-text-faint">—</span>;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-20 rounded-full bg-bg-inset">
        <div
          className="absolute h-1.5 rounded-full bg-accent/30"
          style={{
            left: `${clamp(spread.min)}%`,
            width: `${clamp(spread.max) - clamp(spread.min)}%`,
          }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-accent"
          style={{ left: `${clamp(spread.mean)}%` }}
        />
      </div>
      <span className="tabular text-xs text-text-dim">
        {formatScore(spread.mean)}{' '}
        <span className="text-text-faint">
          ({formatScore(spread.min)}–{formatScore(spread.max)}, n={spread.n})
        </span>
      </span>
    </div>
  );
}
