import { agentSlug } from '@benchmark/schema';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  allTaskParams,
  EMPTY_PARAM,
  getCellsForTask,
  getPairwiseRatings,
  getRelease,
  getRun,
  getTask,
  listPairwiseVerdicts,
  screenshotUrl,
} from '@/lib/data';
import { formatAgentLabel, formatCategory } from '@/lib/format';
import { canonicalUrl, SITE_NAME } from '@/lib/site';
import { EmptyState } from '../../../../components/EmptyState';
import { PairwiseChart } from '../../../../components/PairwiseChart';
import { ScreenshotGallery, type ShotEntry } from '../../../../components/ScreenshotGallery';
import { ShareButton } from '../../../../components/ShareButton';
import { SpreadBand } from '../../../../components/SpreadBand';

export function generateStaticParams() {
  return allTaskParams();
}

type Params = { release: string; taskSlug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { release: releaseId, taskSlug: slug } = await params;
  const release = getRelease(releaseId);
  const task = release && getTask(release, slug);
  if (!release || !task) return {};
  return {
    title: `${task.title} — ${release.release}`,
    alternates: { canonical: `/releases/${release.release}/tasks/${slug}/` },
  };
}

export default async function TaskPage({ params }: { params: Promise<Params> }) {
  const { release: releaseId, taskSlug: slugParam } = await params;
  if (releaseId === EMPTY_PARAM || slugParam === EMPTY_PARAM) return <EmptyState />;

  const release = getRelease(releaseId);
  if (!release) notFound();
  const task = getTask(release, slugParam);
  if (!task) notFound();

  const cells = getCellsForTask(release, task.id);
  const ratings = getPairwiseRatings(release, task.id);
  const verdicts = listPairwiseVerdicts(release.release).filter((v) => v.task === task.id);

  const shots: ShotEntry[] = cells.flatMap((cell) => {
    const primaryRunId = cell.runs[0];
    if (!primaryRunId) return [];
    const run = getRun(primaryRunId);
    if (!run) return [];
    return run.artifacts.screenshots.map((shot) => ({
      agentSlug: agentSlug(cell.agent),
      agentLabel: formatAgentLabel(cell.agent),
      runId: run.id,
      viewport: shot.viewport,
      url: screenshotUrl(run.id, shot.file),
      pagePath: shot.path,
    }));
  });
  const viewports = [...new Set(shots.map((s) => s.viewport))];

  const shareText = `${task.title} (${release.release}): ${cells.length} agents compared on ${SITE_NAME}.`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">
        <Link href={`/releases/${release.release}/`} className="hover:underline">
          {release.release}
        </Link>{' '}
        · {formatCategory(task.category)}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
        <h1 className="font-display text-4xl italic text-text">{task.title}</h1>
        <ShareButton
          text={shareText}
          url={canonicalUrl(`/releases/${release.release}/tasks/${slugParam}/`)}
        />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl italic text-text">Screenshots</h2>
        <div className="mt-4">
          <ScreenshotGallery shots={shots} viewports={viewports} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">Objective and subjective scores</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-[11px] uppercase tracking-[0.1em] text-text-faint">
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Objective</th>
                <th className="py-2 pr-4">Subjective</th>
                <th className="py-2 pr-2">Combined</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => (
                <tr key={agentSlug(cell.agent)} className="border-b border-border">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/releases/${release.release}/agents/${agentSlug(cell.agent)}/`}
                      className="text-text hover:text-accent"
                    >
                      {formatAgentLabel(cell.agent)}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <SpreadBand spread={cell.objective} />
                  </td>
                  <td className="py-2 pr-4">
                    <SpreadBand spread={cell.subjective} />
                  </td>
                  <td className="py-2 pr-2">
                    <SpreadBand spread={cell.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {ratings.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl italic text-text">Pairwise rating</h2>
          <p className="mt-1 text-sm text-text-dim">
            Bradley-Terry strength from blind judge picks, log scale, centred at 0.
          </p>
          <div className="mt-4">
            <PairwiseChart ratings={ratings} />
          </div>
        </section>
      )}

      {verdicts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl italic text-text">Judge verdicts</h2>
          <ul className="mt-4 space-y-3">
            {verdicts.map((v) => (
              <li
                key={`${v.a}-${v.b}-${v.judge.cli}-${v.judge.model}`}
                className="rounded border border-border p-3 text-sm"
              >
                <p className="text-xs uppercase tracking-[0.1em] text-text-faint">
                  {v.judge.cli} · {v.judge.model} picked{' '}
                  <span className="text-accent">
                    {v.winner === 'tie' ? 'a tie' : v.winner === 'a' ? 'A' : 'B'}
                  </span>{' '}
                  · A =
                  <Link
                    href={`/runs/${v.a}/`}
                    className="ml-1 underline decoration-dotted hover:text-accent"
                  >
                    {v.a}
                  </Link>{' '}
                  · B =
                  <Link
                    href={`/runs/${v.b}/`}
                    className="ml-1 underline decoration-dotted hover:text-accent"
                  >
                    {v.b}
                  </Link>
                </p>
                <p className="mt-2 text-text-dim">{v.rationale}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
