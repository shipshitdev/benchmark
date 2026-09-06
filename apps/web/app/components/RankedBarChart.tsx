import type { Standing } from '@benchmark/schema';
import { formatAgentLabel } from '@/lib/format';
import { vendorColor } from '@/lib/vendor-colors';

const BAR_HEIGHT = 22;
const BAR_GAP = 10;
const LABEL_WIDTH = 150;
const CHART_WIDTH = 420;
const PAD_RIGHT = 60;

export type RankedBarChartProps = {
  title: string;
  standings: Standing[];
  metric: (standing: Standing) => number | null;
  format: (value: number) => string;
  /** Sort and framing only — bar length always encodes the raw value, never an inverted "goodness"
   *  scale, so the number on the page always matches the length a reader sees. */
  direction: 'higher-is-better' | 'lower-is-better';
  caption: string;
};

/** One horizontal bar per agent that has this metric, ranked best-first per `direction`, value
 *  printed at the bar's end. Inline SVG, no chart library — the same pattern as the other charts
 *  on this site. */
export function RankedBarChart({
  title,
  standings,
  metric,
  format,
  direction,
  caption,
}: RankedBarChartProps) {
  const rows = standings
    .map((standing) => ({ standing, value: metric(standing) }))
    .filter((row): row is { standing: Standing; value: number } => row.value !== null)
    .sort((a, b) => (direction === 'higher-is-better' ? b.value - a.value : a.value - b.value));

  const height = rows.length * (BAR_HEIGHT + BAR_GAP);
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - PAD_RIGHT;
  const maxValue = Math.max(...rows.map((r) => r.value), 0.0001);

  return (
    <div>
      <h3 className="font-display text-lg italic text-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-text-faint">No agent has this metric yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          role="img"
          aria-label={`${title}, one bar per agent, ${direction.replace('-', ' ')}`}
          className="mt-3 w-full"
        >
          {rows.map((row, i) => {
            const y = i * (BAR_HEIGHT + BAR_GAP);
            const barWidth = (row.value / maxValue) * plotWidth;
            return (
              <g key={`${row.standing.agent.cli}-${row.standing.agent.model}`}>
                <text
                  x={LABEL_WIDTH - 8}
                  y={y + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-text-dim text-[11px]"
                >
                  {formatAgentLabel(row.standing.agent)}
                </text>
                <rect
                  x={LABEL_WIDTH}
                  y={y}
                  width={Math.max(barWidth, 2)}
                  height={BAR_HEIGHT}
                  rx={3}
                  fill={vendorColor(row.standing.agent.cli)}
                  fillOpacity={0.85}
                />
                <text
                  x={LABEL_WIDTH + barWidth + 8}
                  y={y + BAR_HEIGHT / 2}
                  dominantBaseline="middle"
                  className="tabular fill-text text-[11px]"
                >
                  {format(row.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <p className="mt-2 text-xs text-text-faint">{caption}</p>
    </div>
  );
}
