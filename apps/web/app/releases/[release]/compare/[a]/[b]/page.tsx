import { taskSlug } from '@benchmark/schema';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  allCompareParams,
  EMPTY_PARAM,
  getAgentBySlug,
  getCell,
  getRelease,
  getRun,
  getStanding,
  screenshotUrl,
} from '@/lib/data';
import { formatAgentLabel, formatCost, formatScore } from '@/lib/format';
import { canonicalUrl, pageMetadata, SITE_NAME } from '@/lib/site';
import { EmptyState } from '../../../../../components/EmptyState';
import { RunLink } from '../../../../../components/RunLink';
import { ShareButton } from '../../../../../components/ShareButton';
import { SpreadBand } from '../../../../../components/SpreadBand';
import { TelemetryBadge } from '../../../../../components/TelemetryBadge';

export function generateStaticParams() {
  return allCompareParams();
}

type Params = { release: string; a: string; b: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { release: releaseId, a, b } = await params;
  const release = getRelease(releaseId);
  const agentA = release && getAgentBySlug(release, a);
  const agentB = release && getAgentBySlug(release, b);
  if (!release || !agentA || !agentB) return {};
  const standingA = getStanding(release, a);
  const standingB = getStanding(release, b);
  return pageMetadata({
    title: `${formatAgentLabel(agentA)} vs ${formatAgentLabel(agentB)} · ${release.release}`,
    description: `${formatScore(standingA?.overall ?? null)} vs ${formatScore(standingB?.overall ?? null)} overall, ${formatCost(standingA?.usage.costUsdEquivalent ?? null)} vs ${formatCost(standingB?.usage.costUsdEquivalent ?? null)} API-equivalent, task by task.`,
    path: `/releases/${release.release}/compare/${a}/${b}/`,
  });
}

function desktopShot(runId: string | undefined) {
  if (!runId) return null;
  const run = getRun(runId);
  const shot =
    run?.artifacts.screenshots.find((s) => s.viewport === 'desktop') ??
    run?.artifacts.screenshots[0];
  return shot && run ? { url: screenshotUrl(run.id, shot.file), pagePath: shot.path } : null;
}

export default async function ComparePage({ params }: { params: Promise<Params> }) {
  const { release: releaseId, a: aSlug, b: bSlug } = await params;
  if (releaseId === EMPTY_PARAM || aSlug === EMPTY_PARAM || bSlug === EMPTY_PARAM)
    return <EmptyState />;

  const release = getRelease(releaseId);
  if (!release) notFound();
  const standingA = getStanding(release, aSlug);
  const standingB = getStanding(release, bSlug);
  if (!standingA || !standingB) notFound();

  const shareText = `${formatAgentLabel(standingA.agent)} (${formatScore(standingA.overall)}) vs ${formatAgentLabel(standingB.agent)} (${formatScore(standingB.overall)}) on ${SITE_NAME}.`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">
        <Link href={`/releases/${release.release}/`} className="hover:underline">
          {release.release}
        </Link>{' '}
        · compare
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
        <h1 className="font-display text-3xl italic text-text">
          {formatAgentLabel(standingA.agent)} <span className="text-text-faint">vs.</span>{' '}
          {formatAgentLabel(standingB.agent)}
        </h1>
        <ShareButton
          text={shareText}
          url={canonicalUrl(`/releases/${release.release}/compare/${aSlug}/${bSlug}/`)}
        />
      </div>

      <section className="mt-8 grid grid-cols-2 gap-6">
        {[
          { standing: standingA, slug: aSlug },
          { standing: standingB, slug: bSlug },
        ].map(({ standing, slug }) => (
          <div key={slug} className="rounded border border-border p-4">
            <Link
              href={`/releases/${release.release}/agents/${slug}/`}
              className="text-text hover:text-accent"
            >
              {formatAgentLabel(standing.agent)}
            </Link>
            <p className="mt-2 font-display text-3xl tabular text-accent">
              {formatScore(standing.overall)}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs text-text-dim">
              <span>{formatCost(standing.usage.costUsdEquivalent)} API-equiv.</span>
              <TelemetryBadge telemetry={standing.telemetry} />
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">Every task</h2>
        <div className="mt-4 space-y-6">
          {release.tasks.map((task) => {
            const cellA = getCell(release, task.id, aSlug);
            const cellB = getCell(release, task.id, bSlug);
            if (!cellA && !cellB) return null;
            const shotA = desktopShot(cellA?.runs[0]);
            const shotB = desktopShot(cellB?.runs[0]);
            return (
              <div key={task.id} className="rounded border border-border p-4">
                <Link
                  href={`/releases/${release.release}/tasks/${taskSlug(task.id)}/`}
                  className="text-sm text-text hover:text-accent"
                >
                  {task.title}
                </Link>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  {[
                    { side: 'a', cell: cellA, shot: shotA },
                    { side: 'b', cell: cellB, shot: shotB },
                  ].map(({ side, cell, shot }) => (
                    <div key={side}>
                      {shot ? (
                        // biome-ignore lint/performance/noImgElement: static export has no image-optimization server
                        <img
                          src={shot.url}
                          alt={shot.pagePath}
                          className="w-full rounded border border-border bg-bg-inset"
                        />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded border border-dashed border-border text-xs text-text-faint">
                          no screenshot
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <SpreadBand spread={cell?.score ?? null} />
                        {cell?.runs[0] && <RunLink runId={cell.runs[0]}>run</RunLink>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
