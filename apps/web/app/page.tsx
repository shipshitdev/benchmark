import type { Metadata } from 'next';
import Link from 'next/link';
import { buildChangelog } from '@/lib/changelog';
import { getLatestRelease, listReleases, loadTasks } from '@/lib/data';
import { formatDate, formatDuration } from '@/lib/format';
import { canonicalUrl, SITE_NAME } from '@/lib/site';
import { buildReleaseVerdict } from '@/lib/verdict';
import { EmptyState } from './components/EmptyState';
import { RankedBarChart } from './components/RankedBarChart';
import { ReleasePicker } from './components/ReleasePicker';
import { ScoreCostScatter } from './components/ScoreCostScatter';
import { ShareButton } from './components/ShareButton';
import { StandingsTable } from './components/StandingsTable';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function HomePage() {
  const releases = listReleases();
  const latest = getLatestRelease();

  if (!latest) return <EmptyState />;

  const shareText = `${SITE_NAME}: ${latest.release} leaderboard — ${latest.standings.length} agents, ${latest.tasks.length} tasks.`;
  const verdict = buildReleaseVerdict(latest.standings);
  const changelog = buildChangelog(releases, loadTasks());

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-accent">latest release</p>
          <h1 className="mt-2 font-display text-4xl italic text-text">{latest.title}</h1>
          <p className="mt-2 text-sm text-text-dim">
            {latest.release} · suite {latest.suiteVersion} · generated{' '}
            {formatDate(latest.generatedAt)} ·{' '}
            <Link
              href="/methodology/"
              className="underline decoration-dotted underline-offset-4 hover:text-accent"
            >
              methodology
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ReleasePicker releases={releases} current={latest.release} />
          <ShareButton text={shareText} url={canonicalUrl('/')} />
        </div>
      </div>

      <section className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
        <RankedBarChart
          title="Overall score"
          standings={latest.standings}
          metric={(s) => s.overall}
          format={(v) => v.toFixed(1)}
          direction="higher-is-better"
          caption="Overall score — higher is better."
        />
        <RankedBarChart
          title="API-equivalent cost"
          standings={latest.standings}
          metric={(s) =>
            s.usage.costUsdEquivalent !== null && s.usage.costUsdEquivalent > 0
              ? s.usage.costUsdEquivalent
              : null
          }
          format={(v) => `$${v.toFixed(2)}`}
          direction="lower-is-better"
          caption="API-equivalent cost per full run — lower is better."
        />
        <RankedBarChart
          title="Wall time"
          standings={latest.standings}
          metric={(s) => (s.usage.durationMs > 0 ? s.usage.durationMs : null)}
          format={(v) => formatDuration(v)}
          direction="lower-is-better"
          caption="Wall time per full run — lower is better."
        />
      </section>

      <p className="mt-10 max-w-[70ch] font-display text-2xl italic leading-snug text-text">
        {verdict}
      </p>

      <section className="mt-14">
        <StandingsTable release={latest} />
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl italic text-text">Score vs. cost</h2>
        <p className="mt-1 text-sm text-text-dim">
          API-equivalent cost per full run set against overall score, log scale. The shaded corner
          is cheap and good; the dashed line is the Pareto frontier — agents no other agent beats on
          both axes at once.
        </p>
        <div className="mt-6 max-w-2xl">
          <ScoreCostScatter standings={latest.standings} />
        </div>
      </section>

      {changelog.length > 0 && (
        <section className="mt-14 border-t border-border pt-6">
          <h2 className="font-display text-xl italic text-text">Changelog</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {changelog.map((entry) => (
              <li key={`${entry.date}-${entry.text}`} className="flex gap-3">
                <span className="tabular w-24 shrink-0 text-text-faint">
                  {formatDate(entry.date)}
                </span>
                <span className="text-text-dim">{entry.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
