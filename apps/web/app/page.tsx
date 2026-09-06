import type { Metadata } from 'next';
import Link from 'next/link';
import { getLatestRelease, listReleases } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { canonicalUrl, SITE_NAME } from '@/lib/site';
import { EmptyState } from './components/EmptyState';
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

      <section className="mt-10">
        <StandingsTable release={latest} />
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl italic text-text">Score vs. cost</h2>
        <p className="mt-1 text-sm text-text-dim">
          API-equivalent cost per full run set against overall score. Cost is derived from tokens at
          list price, never billed spend.
        </p>
        <div className="mt-6 max-w-2xl">
          <ScoreCostScatter standings={latest.standings} />
        </div>
      </section>
    </div>
  );
}
