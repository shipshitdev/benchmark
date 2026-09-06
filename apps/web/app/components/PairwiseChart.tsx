import type { AgentSpec } from '@benchmark/schema';
import { formatAgentLabel } from '@/lib/format';

type Rating = {
  agent: AgentSpec;
  rating: number;
  ciLow: number;
  ciHigh: number;
  comparisons: number;
};

/** Bradley-Terry ratings with confidence intervals, one horizontal bar per agent, centred on 0. */
export function PairwiseChart({ ratings }: { ratings: Rating[] }) {
  if (ratings.length === 0) return null;
  const bound = Math.max(1, ...ratings.map((r) => Math.max(Math.abs(r.ciLow), Math.abs(r.ciHigh))));
  const scale = (v: number) => 50 + (v / bound) * 48;
  const sorted = [...ratings].sort((a, b) => b.rating - a.rating);

  return (
    <div className="space-y-3">
      {sorted.map((r) => (
        <div
          key={formatAgentLabel(r.agent)}
          className="grid grid-cols-[9rem_1fr] items-center gap-3 text-xs"
        >
          <span className="truncate text-text-dim">{formatAgentLabel(r.agent)}</span>
          <svg
            viewBox="0 0 100 16"
            className="h-4 w-full"
            role="img"
            aria-label={`rating ${r.rating.toFixed(2)}`}
          >
            <line
              x1="50"
              x2="50"
              y1="0"
              y2="16"
              stroke="var(--color-border-strong)"
              strokeWidth="1"
            />
            <line
              x1={scale(r.ciLow)}
              x2={scale(r.ciHigh)}
              y1="8"
              y2="8"
              stroke="var(--color-accent)"
              strokeOpacity="0.4"
              strokeWidth="3"
            />
            <circle cx={scale(r.rating)} cy="8" r="3" fill="var(--color-accent)" />
          </svg>
          <span className="tabular col-start-2 -mt-2 text-[10px] text-text-faint">
            {r.rating.toFixed(2)} [{r.ciLow.toFixed(2)}, {r.ciHigh.toFixed(2)}] · {r.comparisons}{' '}
            comparisons
          </span>
        </div>
      ))}
    </div>
  );
}
