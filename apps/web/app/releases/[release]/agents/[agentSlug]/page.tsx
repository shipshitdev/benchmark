import { agentSlug, CATEGORIES, priceKeyFor, taskSlug } from '@benchmark/schema';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  allAgentParams,
  EMPTY_PARAM,
  getCellsForAgent,
  getPrices,
  getRelease,
  getStanding,
} from '@/lib/data';
import {
  formatAgentLabel,
  formatCategory,
  formatCost,
  formatDuration,
  formatScore,
  formatTokens,
} from '@/lib/format';
import { canonicalUrl, pageMetadata } from '@/lib/site';
import { buildAgentVerdict, type Rank, rankAmong } from '@/lib/verdict';
import { EmptyState } from '../../../../components/EmptyState';
import { RunLink } from '../../../../components/RunLink';
import { ShareButton } from '../../../../components/ShareButton';
import { SpreadBand } from '../../../../components/SpreadBand';
import { TelemetryBadge } from '../../../../components/TelemetryBadge';
import { TokenCostBar } from '../../../../components/TokenCostBar';

function rankLabel(rank: Rank | null): string {
  return rank ? `#${rank.rank} of ${rank.total}` : '—';
}

export function generateStaticParams() {
  return allAgentParams();
}

type Params = { release: string; agentSlug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { release: releaseId, agentSlug: slug } = await params;
  const release = getRelease(releaseId);
  const standing = release && getStanding(release, slug);
  if (!release || !standing) return {};
  return pageMetadata({
    title: `${formatAgentLabel(standing.agent)} · ${release.release}`,
    description: `${formatScore(standing.overall)} overall on the ${release.release} suite, ${formatCost(standing.usage.costUsdEquivalent)} API-equivalent, ${standing.telemetry} telemetry. Every number links to its run.`,
    path: `/releases/${release.release}/agents/${slug}/`,
  });
}

export default async function AgentPage({ params }: { params: Promise<Params> }) {
  const { release: releaseId, agentSlug: slugParam } = await params;
  if (releaseId === EMPTY_PARAM || slugParam === EMPTY_PARAM) return <EmptyState />;

  const release = getRelease(releaseId);
  if (!release) notFound();
  const standing = getStanding(release, slugParam);
  if (!standing) notFound();

  const cells = getCellsForAgent(release, slugParam);
  const categories = CATEGORIES.filter((c) => release.categoryWeights[c] !== undefined);
  const shareText = `${formatAgentLabel(standing.agent)} on ${release.release}: ${formatScore(standing.overall)} overall, ${formatCost(standing.usage.costUsdEquivalent)} API-equivalent.`;

  const overallRank = rankAmong(release.standings, (s) => s.overall, 'higher-is-better', standing);
  const costEfficiencyRank = rankAmong(
    release.standings,
    (s) => s.scorePerDollar,
    'higher-is-better',
    standing,
  );
  const wallTimeRank = rankAmong(
    release.standings,
    (s) => (s.usage.durationMs > 0 ? s.usage.durationMs : null),
    'lower-is-better',
    standing,
  );
  const verdict = buildAgentVerdict(release.standings, standing);
  const prices = getPrices();
  const priceKey = priceKeyFor(standing.agent.model);
  const price = prices && priceKey ? prices.models[priceKey] : undefined;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">
        <Link href={`/releases/${release.release}/`} className="hover:underline">
          {release.release}
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl italic text-text">
            {formatAgentLabel(standing.agent)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-display text-3xl tabular text-accent">
              {formatScore(standing.overall)}
            </span>
            <span className="text-xs uppercase tracking-[0.1em] text-text-faint">overall</span>
            <TelemetryBadge telemetry={standing.telemetry} />
          </div>
        </div>
        <ShareButton
          text={shareText}
          url={canonicalUrl(`/releases/${release.release}/agents/${slugParam}/`)}
        />
      </div>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Overall rank', rankLabel(overallRank)],
          ['Cost efficiency rank', rankLabel(costEfficiencyRank)],
          ['Wall time rank', rankLabel(wallTimeRank)],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-border p-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">{label}</p>
            <p className="mt-1 tabular text-lg text-text">{value}</p>
          </div>
        ))}
        <div className="rounded border border-border p-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">Telemetry</p>
          <p className="mt-1.5">
            <TelemetryBadge telemetry={standing.telemetry} />
          </p>
        </div>
      </section>

      <p className="mt-6 max-w-[70ch] text-[15px] leading-relaxed text-text-dim">{verdict}</p>

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">Tokens by class</h2>
        <p className="mt-1 text-sm text-text-dim">
          Segment width is dollar share, not token share — where the API-equivalent cost actually
          went.
        </p>
        <div className="mt-4 max-w-2xl">
          <TokenCostBar usage={standing.usage} price={price} />
        </div>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Tokens in', formatTokens(standing.usage.input)],
          ['Tokens out', formatTokens(standing.usage.output)],
          ['Turns', standing.usage.turns?.toLocaleString('en-US') ?? '—'],
          ['Wall time', formatDuration(standing.usage.durationMs)],
          ['API-equiv. cost', formatCost(standing.usage.costUsdEquivalent)],
          ['Score / $', standing.scorePerDollar?.toFixed(1) ?? '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-border p-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">{label}</p>
            <p className="mt-1 tabular text-lg text-text">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">Category scores</h2>
        <div className="mt-4 flex flex-wrap gap-6">
          {categories.map((c) => {
            const cat = standing.categories.find((cs) => cs.category === c);
            return (
              <div key={c}>
                <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                  {formatCategory(c)}
                </p>
                <p className="tabular text-lg text-text">
                  {formatScore(cat?.score ?? null)}{' '}
                  <span className="text-xs text-text-faint">({cat?.tasks ?? 0} tasks)</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">Per task</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-[11px] uppercase tracking-[0.1em] text-text-faint">
                <th className="py-2 pr-4">Task</th>
                <th className="py-2 pr-4 text-right">Gate pass</th>
                <th className="py-2 pr-4">Objective</th>
                <th className="py-2 pr-4">Subjective</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-2">Runs</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => {
                const task = release.tasks.find((t) => t.id === cell.task);
                const slug = taskSlug(cell.task);
                return (
                  <tr key={cell.task} className="border-b border-border">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/releases/${release.release}/tasks/${slug}/`}
                        className="text-text hover:text-accent"
                      >
                        {task?.title ?? cell.task}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right tabular text-text-dim">
                      {Math.round(cell.gatePassRate * 100)}%
                    </td>
                    <td className="py-2 pr-4">
                      <SpreadBand spread={cell.objective} />
                    </td>
                    <td className="py-2 pr-4">
                      <SpreadBand spread={cell.subjective} />
                    </td>
                    <td className="py-2 pr-4">
                      <SpreadBand spread={cell.score} />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {cell.runs.map((runId, i) => (
                          <RunLink key={runId} runId={runId}>
                            #{i + 1}
                          </RunLink>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 flex flex-wrap gap-2">
        {release.agents
          .filter((a) => agentSlug(a) !== slugParam)
          .map((other) => {
            const [a, b] = [slugParam, agentSlug(other)].sort();
            return (
              <Link
                key={agentSlug(other)}
                href={`/releases/${release.release}/compare/${a}/${b}/`}
                className="rounded border border-border-strong px-2.5 py-1 text-xs text-text-dim hover:border-accent hover:text-accent"
              >
                compare vs. {formatAgentLabel(other)}
              </Link>
            );
          })}
      </section>
    </div>
  );
}
