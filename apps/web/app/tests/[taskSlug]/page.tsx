import { agentSlug } from '@benchmark/schema';
import { marked } from 'marked';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScoringBadges } from '@/app/components/ScoringBadges';
import { ScreenshotGallery, type ShotEntry } from '@/app/components/ScreenshotGallery';
import { ShareButton } from '@/app/components/ShareButton';
import { SpreadBand } from '@/app/components/SpreadBand';
import {
  allTestsParams,
  countObjectiveCases,
  EMPTY_PARAM,
  getLoadedTask,
  getRun,
  getTaskPrompt,
  getTaskRubric,
  listFixtureFiles,
  listReleases,
  readFixtureFile,
  screenshotUrl,
} from '@/lib/data';
import { formatAgentLabel, formatCategory, formatDate } from '@/lib/format';
import { canonicalUrl, pageMetadata, SITE_NAME } from '@/lib/site';
import { gateSentence, scoringBadges, TASK_QUESTIONS } from '@/lib/tests';

export function generateStaticParams() {
  return allTestsParams();
}

type Params = { taskSlug: string };

const KEY_FIXTURE_FILES = ['README.md', 'openapi.yaml', 'ISSUE.md'];

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { taskSlug: slug } = await params;
  const task = getLoadedTask(slug);
  if (!task) return {};
  return pageMetadata({
    title: `${task.manifest.title} · ${SITE_NAME}`,
    description: task.manifest.summary,
    path: `/tests/${slug}/`,
  });
}

export default async function TestDetailPage({ params }: { params: Promise<Params> }) {
  const { taskSlug: slug } = await params;
  if (slug === EMPTY_PARAM) notFound();

  const task = getLoadedTask(slug);
  if (!task) notFound();
  const { manifest } = task;

  const prompt = getTaskPrompt(task);
  const rubricMarkdown = getTaskRubric(task);
  const rubricHtml = rubricMarkdown ? await marked.parse(rubricMarkdown) : null;
  const fixtureFiles = listFixtureFiles(task);
  const keyFiles = KEY_FIXTURE_FILES.map((relPath) => ({
    relPath,
    content: readFixtureFile(task, relPath),
  })).filter((f): f is { relPath: string; content: string } => f.content !== undefined);
  const hiddenCaseCount = countObjectiveCases(task);

  const releases = listReleases().filter((r) => r.tasks.some((t) => t.id === manifest.id));
  const hasScreenshots = manifest.artifacts.screenshots.length > 0;

  const shareText = `${manifest.title}: how the suite scores it, and every agent's result — ${SITE_NAME}.`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">
        <Link href="/tests/" className="hover:underline">
          tests
        </Link>{' '}
        · {formatCategory(manifest.category)}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl italic text-text">{manifest.title}</h1>
          <p className="mt-2 text-[15px] text-text-dim">{TASK_QUESTIONS[manifest.id]}</p>
        </div>
        <ShareButton text={shareText} url={canonicalUrl(`/tests/${slug}/`)} />
      </div>

      <section className="mt-6 flex flex-wrap items-center gap-4 text-xs text-text-faint">
        <span>v{manifest.version}</span>
        <span>authored {formatDate(`${manifest.authored}T00:00:00.000Z`)}</span>
        <span>
          {manifest.caps.maxTurns} turns · ${manifest.caps.maxBudgetUsd} budget ·{' '}
          {manifest.caps.timeboxMinutes}m timebox
        </span>
        <ScoringBadges badges={scoringBadges(manifest)} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">Prompt</h2>
        <pre className="mt-3 max-w-[70ch] overflow-x-auto whitespace-pre-wrap rounded border border-border bg-bg-inset p-4 text-[15px] leading-relaxed text-text-dim">
          {prompt}
        </pre>
      </section>

      {manifest.fixture && (
        <section className="mt-10">
          <h2 className="font-display text-xl italic text-text">Fixture</h2>
          <p className="mt-2 text-sm text-text-dim">
            {fixtureFiles.length} paths under <code className="text-text">{manifest.fixture}/</code>
            , copied into a fresh run dir for every attempt.
          </p>
          <div className="mt-3 max-h-64 overflow-y-auto rounded border border-border bg-bg-inset p-3 font-mono text-xs text-text-dim">
            {fixtureFiles.map((entry) => (
              <div key={entry.relPath} className={entry.isDir ? 'text-text-faint' : ''}>
                {entry.relPath}
                {entry.isDir ? '/' : ''}
              </div>
            ))}
          </div>
          {keyFiles.length > 0 && (
            <div className="mt-4 space-y-4">
              {keyFiles.map((f) => (
                <div key={f.relPath}>
                  <p className="text-xs uppercase tracking-[0.1em] text-text-faint">{f.relPath}</p>
                  <pre className="mt-1 max-h-72 overflow-auto rounded border border-border bg-bg-inset p-3 text-xs text-text-dim">
                    {f.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">How it is scored</h2>

        {manifest.gates.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.1em] text-text-faint">
              Gates, run in order
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1.5 text-[15px] text-text-dim">
              {manifest.gates.map((gate) => (
                <li key={gate.id}>
                  <span className="text-text">{gate.id}</span> — {gateSentence(gate)}
                </li>
              ))}
            </ol>
          </div>
        )}

        {manifest.scoring.objective && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.1em] text-text-faint">Objective layer</p>
            <p className="mt-2 text-[15px] text-text-dim">
              {hiddenCaseCount !== null ? (
                <>
                  <span className="tabular text-text">{hiddenCaseCount}</span>{' '}
                  {manifest.scoring.objective.type === 'checklist'
                    ? 'planted issues to find, judged for recall with a penalty for unsupported findings.'
                    : 'hidden test cases the agent never saw, run against its own code.'}
                </>
              ) : (
                'Scored against a hidden spec not shown here.'
              )}
            </p>
          </div>
        )}

        {manifest.scoring.subjective && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.1em] text-text-faint">
              Subjective layer · weights
            </p>
            <ul className="mt-2 flex flex-wrap gap-3 text-sm text-text-dim">
              {manifest.scoring.subjective.dimensions.map((d) => (
                <li key={d.id} className="rounded border border-border px-2.5 py-1">
                  {d.label} <span className="tabular text-text-faint">({d.weight})</span>
                </li>
              ))}
            </ul>
            {rubricHtml && (
              <article
                className="markdown-body mt-4 max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: rubric.md is this repo's own content, not user input
                dangerouslySetInnerHTML={{ __html: rubricHtml }}
              />
            )}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl italic text-text">Results across releases</h2>
        {releases.length === 0 ? (
          <p className="mt-3 text-sm text-text-faint">No release has run this task yet.</p>
        ) : (
          releases.map((release) => {
            const cells = release.cells.filter((c) => c.task === manifest.id);
            const shots: ShotEntry[] = hasScreenshots
              ? cells.flatMap((cell) => {
                  const runId = cell.runs[0];
                  const run = runId ? getRun(runId) : undefined;
                  if (!run) return [];
                  return run.artifacts.screenshots.map((shot) => ({
                    agentSlug: agentSlug(cell.agent),
                    agentLabel: formatAgentLabel(cell.agent),
                    runId: run.id,
                    viewport: shot.viewport,
                    url: screenshotUrl(run.id, shot.file),
                    pagePath: shot.path,
                  }));
                })
              : [];
            const viewports = [...new Set(shots.map((s) => s.viewport))];

            return (
              <div key={release.release} className="mt-6 border-t border-border pt-6">
                <p className="text-sm text-text-dim">
                  <Link
                    href={`/releases/${release.release}/`}
                    className="text-text hover:text-accent"
                  >
                    {release.release}
                  </Link>{' '}
                  · {formatDate(release.generatedAt)}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-strong text-left text-[11px] uppercase tracking-[0.1em] text-text-faint">
                        <th className="py-2 pr-4">Agent</th>
                        <th className="py-2 pr-4">Objective</th>
                        <th className="py-2 pr-4">Subjective</th>
                        <th className="py-2 pr-4">Combined</th>
                        <th className="py-2 pr-2">Run</th>
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
                          <td className="py-2 pr-4">
                            <SpreadBand spread={cell.score} />
                          </td>
                          <td className="py-2 pr-2 text-xs">
                            {cell.runs.map((runId, i) => (
                              <Link
                                key={runId}
                                href={`/runs/${runId}/`}
                                className="underline decoration-dotted underline-offset-4 hover:text-accent"
                              >
                                #{i + 1}
                              </Link>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasScreenshots && (
                  <div className="mt-4">
                    <ScreenshotGallery shots={shots} viewports={viewports} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
