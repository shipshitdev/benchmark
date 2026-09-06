import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allReleaseParams, EMPTY_PARAM, getRelease, listReleases } from '@/lib/data';
import { formatAgentLabel, formatDate, formatScore } from '@/lib/format';
import { canonicalUrl, pageMetadata, SITE_NAME } from '@/lib/site';
import { buildReleaseVerdict } from '@/lib/verdict';
import { EmptyState } from '../../components/EmptyState';
import { ReleasePicker } from '../../components/ReleasePicker';
import { ScoreCostScatter } from '../../components/ScoreCostScatter';
import { ShareButton } from '../../components/ShareButton';
import { StandingsTable } from '../../components/StandingsTable';

export function generateStaticParams() {
  return allReleaseParams();
}

type Params = { release: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { release: releaseId } = await params;
  const release = getRelease(releaseId);
  if (!release) return {};
  const ranked = [...release.standings].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  const leader = ranked[0];
  return pageMetadata({
    title: `${release.release} leaderboard`,
    description: `${release.agents.length} agents, ${release.tasks.length} tasks${leader?.overall !== null && leader ? `. Leader: ${formatAgentLabel(leader.agent)} at ${formatScore(leader.overall)}` : ''}. Scored on gates, hidden tests and blind judging, with tokens and API-equivalent cost.`,
    path: `/releases/${release.release}/`,
  });
}

export default async function ReleasePage({ params }: { params: Promise<Params> }) {
  const { release: releaseId } = await params;
  if (releaseId === EMPTY_PARAM) return <EmptyState />;
  const release = getRelease(releaseId);
  if (!release) notFound();

  const releases = listReleases();
  const shareText = `${SITE_NAME}: ${release.release} leaderboard — ${release.standings.length} agents, ${release.tasks.length} tasks.`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-accent">release</p>
          <h1 className="mt-2 font-display text-4xl italic text-text">{release.title}</h1>
          <p className="mt-2 text-sm text-text-dim">
            {release.release} · suite {release.suiteVersion} · generated{' '}
            {formatDate(release.generatedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ReleasePicker releases={releases} current={release.release} />
          <ShareButton text={shareText} url={canonicalUrl(`/releases/${release.release}/`)} />
        </div>
      </div>

      <p className="mt-8 max-w-[70ch] font-display text-2xl italic leading-snug text-text">
        {buildReleaseVerdict(release.standings)}
      </p>

      <section className="mt-10">
        <StandingsTable release={release} />
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl italic text-text">Score vs. cost</h2>
        <div className="mt-6 max-w-2xl">
          <ScoreCostScatter standings={release.standings} />
        </div>
      </section>

      {release.notes.length > 0 && (
        <section className="mt-14 border-t border-border pt-6 text-xs text-text-faint">
          <h2 className="uppercase tracking-[0.15em] text-text-dim">Notes</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {release.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
