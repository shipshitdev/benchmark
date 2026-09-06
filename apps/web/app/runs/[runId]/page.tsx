import { agentSlug, taskSlug } from '@benchmark/schema';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  allRunParams,
  EMPTY_PARAM,
  getRun,
  getRunDiff,
  getRunGateLogs,
  getRunReport,
  getRunTranscript,
  screenshotUrl,
} from '@/lib/data';
import {
  formatAgentLabel,
  formatCost,
  formatDateTime,
  formatDuration,
  formatTokens,
} from '@/lib/format';
import { pageMetadata } from '@/lib/site';
import { DiffViewer } from '../../components/DiffViewer';
import { EmptyState } from '../../components/EmptyState';
import { TranscriptViewer } from '../../components/TranscriptViewer';

export function generateStaticParams() {
  return allRunParams();
}

type Params = { runId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { runId } = await params;
  const run = getRun(runId);
  if (!run) return {};
  return pageMetadata({
    title: `${run.task} · ${formatAgentLabel(run.agent)} · attempt ${run.attempt}`,
    description: `Status ${run.status}, ${formatCost(run.usage.costUsdEquivalent)} API-equivalent, ${run.usage.turns ?? 'unknown'} turns. Transcript, diff, gates, screenshots and judgments.`,
    path: `/runs/${run.id}/`,
  });
}

export default async function RunPage({ params }: { params: Promise<Params> }) {
  const { runId } = await params;
  if (runId === EMPTY_PARAM) return <EmptyState />;

  const run = getRun(runId);
  if (!run) notFound();

  const diff = getRunDiff(run);
  const report = getRunReport(run);
  const transcript = getRunTranscript(run);
  const gateLogs = new Map(getRunGateLogs(run).map((g) => [g.id, g.log]));

  const statusClass = run.status === 'ok' ? 'text-good border-good/40' : 'text-bad border-bad/40';

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">
        <Link
          href={`/releases/${run.release}/agents/${agentSlug(run.agent)}/`}
          className="hover:underline"
        >
          {formatAgentLabel(run.agent)}
        </Link>{' '}
        ·{' '}
        <Link
          href={`/releases/${run.release}/tasks/${taskSlug(run.task)}/`}
          className="hover:underline"
        >
          {run.task}
        </Link>{' '}
        · attempt {run.attempt}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl italic text-text">{run.id}</h1>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${statusClass}`}
        >
          {run.status}
        </span>
      </div>
      <p className="mt-2 text-xs text-text-faint">
        {formatDateTime(run.startedAt)} → {formatDateTime(run.finishedAt)} on {run.host} · suite{' '}
        {run.suiteVersion}
      </p>

      <section className="mt-8">
        <h2 className="font-display text-lg italic text-text">Command</h2>
        <pre className="mt-2 overflow-x-auto rounded border border-border bg-bg-inset p-3 text-xs text-text-dim">
          {run.agent.command.join(' ')}
        </pre>
        <p className="mt-1 text-xs text-text-faint">
          {run.agent.cli} {run.agent.version} · permission mode {run.agent.permissionMode} · max{' '}
          {run.agent.caps.maxTurns} turns · ${run.agent.caps.maxBudgetUsd} budget ·{' '}
          {run.agent.caps.timeboxMinutes}m timebox
        </p>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Tokens in', formatTokens(run.usage.input)],
          ['Tokens out', formatTokens(run.usage.output)],
          ['Cache read', formatTokens(run.usage.cacheRead)],
          ['Cache write', formatTokens(run.usage.cacheWrite)],
          ['Turns', run.usage.turns?.toLocaleString('en-US') ?? '—'],
          ['Tool calls', run.usage.toolCalls?.toLocaleString('en-US') ?? '—'],
          ['Wall time', formatDuration(run.usage.durationMs)],
          ['API-equiv. cost', formatCost(run.usage.costUsdEquivalent)],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-border p-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">{label}</p>
            <p className="mt-1 tabular text-lg text-text">{value}</p>
          </div>
        ))}
      </section>
      {run.usage.reportedCostUsd !== undefined && (
        <p className="mt-2 text-xs text-text-faint">
          CLI-reported cost (cross-check): {formatCost(run.usage.reportedCostUsd)}
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg italic text-text">Gates</h2>
        <ul className="mt-4 space-y-2">
          {run.gates.map((gate) => (
            <li key={gate.id} className="rounded border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={gate.pass ? 'text-good' : 'text-bad'}>
                  {gate.pass ? 'pass' : 'fail'}
                </span>
                <span className="text-text">{gate.id}</span>
                <span className="tabular text-xs text-text-faint">
                  {formatDuration(gate.durationMs)}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-dim">{gate.detail}</p>
              {gateLogs.has(gate.id) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-text-faint">raw log</summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-text-faint">
                    {gateLogs.get(gate.id)}
                  </pre>
                </details>
              )}
            </li>
          ))}
          {run.gates.length === 0 && (
            <p className="text-sm text-text-faint">This task has no deterministic gates.</p>
          )}
        </ul>
      </section>

      {run.artifacts.screenshots.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg italic text-text">Screenshots</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {run.artifacts.screenshots.map((shot) => (
              // biome-ignore lint/performance/noImgElement: static export has no image-optimization server
              <img
                key={shot.file}
                src={screenshotUrl(run.id, shot.file)}
                alt={`${shot.path} at ${shot.viewport}`}
                className="w-full rounded border border-border bg-bg-inset"
              />
            ))}
          </div>
        </section>
      )}

      {run.judgments.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg italic text-text">Judgments</h2>
          <ul className="mt-4 space-y-3">
            {run.judgments.map((j) => (
              <li
                key={`${j.judge.cli}-${j.judge.model}-${j.blindLabel}`}
                className="rounded border border-border p-3 text-sm"
              >
                <p className="text-xs uppercase tracking-[0.1em] text-text-faint">
                  {j.judge.cli} · {j.judge.model} · label {j.blindLabel} ·{' '}
                  <span className="tabular text-accent">{j.subjective.toFixed(1)}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-dim">
                  {Object.entries(j.scores).map(([dim, score]) => (
                    <span key={dim} className="tabular">
                      {dim}: {score}/4
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-text-dim">{j.rationale}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report && (
        <section className="mt-10">
          <h2 className="font-display text-lg italic text-text">Report</h2>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded border border-border bg-bg-inset p-4 text-xs text-text-dim">
            {report}
          </pre>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg italic text-text">Diff</h2>
        <div className="mt-4">
          <DiffViewer diff={diff} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg italic text-text">Transcript</h2>
        <div className="mt-4">
          <TranscriptViewer lines={transcript} />
        </div>
      </section>

      {run.notes.length > 0 && (
        <section className="mt-10 border-t border-border pt-6 text-xs text-text-faint">
          <h2 className="uppercase tracking-[0.15em] text-text-dim">Notes</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {run.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
