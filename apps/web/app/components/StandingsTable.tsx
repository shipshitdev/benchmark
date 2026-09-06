import { agentSlug, CATEGORIES, type Release } from '@benchmark/schema';
import Link from 'next/link';
import {
  formatAgentLabel,
  formatCategory,
  formatCost,
  formatDuration,
  formatScore,
  formatScorePerDollar,
  formatTokens,
} from '@/lib/format';
import { TelemetryBadge } from './TelemetryBadge';

/** Leaderboard for one release. Every cell links to the agent's drill-down page, where the same
 *  numbers break down per task with links to the exact runs they were measured from. */
export function StandingsTable({ release }: { release: Release }) {
  const categories = CATEGORIES.filter((c) => release.categoryWeights[c] !== undefined);
  const ranked = [...release.standings].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-strong text-left text-[11px] uppercase tracking-[0.1em] text-text-faint">
            <th className="py-3 pr-4">Agent</th>
            <th className="py-3 pr-4 text-right">Overall</th>
            {categories.map((c) => (
              <th key={c} className="py-3 pr-4 text-right">
                {formatCategory(c)}
              </th>
            ))}
            <th className="py-3 pr-4 text-right">Tokens in</th>
            <th className="py-3 pr-4 text-right">Tokens out</th>
            <th className="py-3 pr-4 text-right">Turns</th>
            <th className="py-3 pr-4 text-right">Wall time</th>
            <th className="py-3 pr-4 text-right">API-equiv. cost</th>
            <th className="py-3 pr-4 text-right">Score / $</th>
            <th className="py-3 pr-2 text-right">Telemetry</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((standing, rank) => {
            const slug = agentSlug(standing.agent);
            const href = `/releases/${release.release}/agents/${slug}/`;
            return (
              <tr key={slug} className="border-b border-border hover:bg-bg-raised">
                <td className="py-3 pr-4">
                  <Link href={href} className="flex items-baseline gap-2">
                    <span className="tabular text-text-faint">
                      {String(rank + 1).padStart(2, '0')}
                    </span>
                    <span className="text-text hover:text-accent">
                      {formatAgentLabel(standing.agent)}
                    </span>
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right">
                  <Link href={href} className="tabular font-semibold text-text hover:text-accent">
                    {formatScore(standing.overall)}
                  </Link>
                </td>
                {categories.map((c) => {
                  const cat = standing.categories.find((cs) => cs.category === c);
                  return (
                    <td key={c} className="py-3 pr-4 text-right">
                      <Link href={href} className="tabular text-text-dim hover:text-accent">
                        {formatScore(cat?.score ?? null)}
                      </Link>
                    </td>
                  );
                })}
                <td className="py-3 pr-4 text-right">
                  <Link href={href} className="tabular text-text-dim hover:text-accent">
                    {formatTokens(standing.usage.input)}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right">
                  <Link href={href} className="tabular text-text-dim hover:text-accent">
                    {formatTokens(standing.usage.output)}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right">
                  <Link href={href} className="tabular text-text-dim hover:text-accent">
                    {standing.usage.turns ?? '—'}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right">
                  <Link href={href} className="tabular text-text-dim hover:text-accent">
                    {formatDuration(standing.usage.durationMs)}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right">
                  <Link href={href} className="tabular text-text-dim hover:text-accent">
                    {formatCost(standing.usage.costUsdEquivalent)}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right">
                  <Link href={href} className="tabular text-accent hover:underline">
                    {formatScorePerDollar(standing.scorePerDollar)}
                  </Link>
                </td>
                <td className="py-3 pr-2 text-right">
                  <TelemetryBadge telemetry={standing.telemetry} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
