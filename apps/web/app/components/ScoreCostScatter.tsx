import { agentSlug, type Standing } from '@benchmark/schema';
import { formatAgentLabel, formatCost } from '@/lib/format';

const WIDTH = 640;
const HEIGHT = 380;
const PAD_LEFT = 56;
const PAD_BOTTOM = 40;
const PAD_TOP = 32;
const PAD_RIGHT = 20;

/** Score-vs-cost scatter, inline SVG, no chart library. X axis is API-equivalent cost per run set
 *  on a log scale (costs span orders of magnitude across models); Y axis is the overall score. */
export function ScoreCostScatter({ standings }: { standings: Standing[] }) {
  const points = standings
    .filter(
      (s) =>
        s.overall !== null && s.usage.costUsdEquivalent !== null && s.usage.costUsdEquivalent > 0,
    )
    .map((s) => ({
      standing: s,
      score: s.overall as number,
      cost: s.usage.costUsdEquivalent as number,
    }));

  if (points.length === 0) {
    return (
      <p className="text-sm text-text-faint">
        No agent has both a score and a known API-equivalent cost yet — the scatter needs both.
      </p>
    );
  }

  const costs = points.map((p) => p.cost);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const logMin = Math.log10(Math.max(minCost, 0.001)) - 0.2;
  const logMax = Math.log10(maxCost) + 0.2;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (cost: number) => PAD_LEFT + ((Math.log10(cost) - logMin) / (logMax - logMin)) * plotW;
  const y = (score: number) => PAD_TOP + plotH - (score / 100) * plotH;

  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = Array.from({ length: 4 }, (_, i) => logMin + ((logMax - logMin) * i) / 3);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Score versus API-equivalent cost, one point per agent"
      className="w-full"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          <text
            x={PAD_LEFT - 10}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-text-faint text-[11px]"
          >
            {tick}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text
          key={tick}
          x={x(10 ** tick)}
          y={HEIGHT - PAD_BOTTOM + 20}
          textAnchor="middle"
          className="fill-text-faint text-[11px] tabular"
        >
          {formatCost(10 ** tick)}
        </text>
      ))}
      <line
        x1={PAD_LEFT}
        x2={PAD_LEFT}
        y1={PAD_TOP}
        y2={HEIGHT - PAD_BOTTOM}
        stroke="var(--color-border-strong)"
        strokeWidth={1}
      />
      <line
        x1={PAD_LEFT}
        x2={WIDTH - PAD_RIGHT}
        y1={HEIGHT - PAD_BOTTOM}
        y2={HEIGHT - PAD_BOTTOM}
        stroke="var(--color-border-strong)"
        strokeWidth={1}
      />
      <text x={4} y={12} className="fill-text-faint text-[10px] uppercase tracking-[0.1em]">
        score
      </text>
      <text
        x={WIDTH - PAD_RIGHT}
        y={HEIGHT - 4}
        textAnchor="end"
        className="fill-text-faint text-[10px] uppercase tracking-[0.1em]"
      >
        API-equivalent cost (log)
      </text>
      {points.map((p) => (
        <g key={agentSlug(p.standing.agent)}>
          <circle
            cx={x(p.cost)}
            cy={y(p.score)}
            r={6}
            fill="var(--color-accent)"
            fillOpacity={0.85}
          />
          {x(p.cost) > WIDTH * 0.6 ? (
            <text
              x={x(p.cost) - 10}
              y={y(p.score) + 4}
              textAnchor="end"
              className="fill-text text-[11px]"
            >
              {formatAgentLabel(p.standing.agent)}
            </text>
          ) : (
            <text x={x(p.cost) + 10} y={y(p.score) + 4} className="fill-text text-[11px]">
              {formatAgentLabel(p.standing.agent)}
            </text>
          )}
          <title>
            {formatAgentLabel(p.standing.agent)}: {p.score.toFixed(1)} score, {formatCost(p.cost)}
          </title>
        </g>
      ))}
    </svg>
  );
}
