import { readFileSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getBenchConfig,
  getLatestRelease,
  getPrices,
  getRunsForRelease,
  loadTasks,
} from '@/lib/data';
import { formatCategory, formatDate } from '@/lib/format';
import { deriveKnownLimits } from '@/lib/methodology';

export const metadata: Metadata = {
  title: 'Methodology',
  alternates: { canonical: '/methodology/' },
};

function readMethodologyContent(): string {
  return readFileSync(path.join(process.cwd(), 'content', 'methodology.md'), 'utf8');
}

const OBJECTIVE_LABEL: Record<string, string> = {
  'playwright-pass-rate': 'Hidden Playwright tests',
  'http-contract-pass-rate': 'Hidden contract tests',
  'hidden-tests': 'Hidden unit tests',
  checklist: 'Planted-issue checklist',
};

export default async function MethodologyPage() {
  const markdown = readMethodologyContent();
  const html = await marked.parse(markdown);
  const prices = getPrices();
  const latest = getLatestRelease();
  const config = getBenchConfig();
  const tasks = loadTasks();

  const knownLimits = latest
    ? deriveKnownLimits({
        release: latest,
        runs: getRunsForRelease(latest),
        configuredJudges: config.judges,
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">methodology</p>
      <h1 className="mt-2 font-display text-4xl italic text-text">Task suite and scoring</h1>

      <section className="mt-6 grid grid-cols-1 gap-3 rounded border border-border p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
            Price table as of
          </p>
          <p className="tabular mt-1 text-text">
            {prices ? formatDate(prices.asOf) : 'no price table published yet'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
            Judge panel (latest release)
          </p>
          <p className="mt-1 text-text">
            {latest && latest.judges.length > 0
              ? latest.judges.map((j) => `${j.cli} · ${j.model}`).join(', ')
              : 'no release judged yet'}
          </p>
        </div>
      </section>

      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: markdown source is this repo's own content/methodology.md, not user input */}
      <article className="markdown-body mt-10" dangerouslySetInnerHTML={{ __html: html }} />

      <section className="mt-12">
        <h2 className="font-display text-2xl italic text-text">The task suite</h2>
        <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-text-dim">
          Suite version {config.suiteVersion}, read live from every <code>task.yaml</code> in the
          repo. Full prompt, fixture, and scoring detail for each task lives on its{' '}
          <Link href="/tests/" className="text-accent underline underline-offset-4">
            test page
          </Link>
          .
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-[11px] uppercase tracking-[0.1em] text-text-faint">
                <th className="py-2 pr-4">Task</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Caps</th>
                <th className="py-2 pr-4">Gates</th>
                <th className="py-2 pr-4">Objective</th>
                <th className="py-2 pr-4">Subjective dimensions</th>
                <th className="py-2 pr-2 text-right">Pairwise</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(({ manifest, slug }) => (
                <tr key={manifest.id} className="border-b border-border align-top">
                  <td className="py-2 pr-4">
                    <Link href={`/tests/${slug}/`} className="text-text hover:text-accent">
                      {manifest.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-text-dim">{formatCategory(manifest.category)}</td>
                  <td className="py-2 pr-4 text-text-dim">
                    {manifest.caps.maxTurns} turns · ${manifest.caps.maxBudgetUsd} ·{' '}
                    {manifest.caps.timeboxMinutes}m
                  </td>
                  <td className="py-2 pr-4 text-text-dim">
                    {manifest.gates.length > 0 ? manifest.gates.map((g) => g.id).join(', ') : '—'}
                  </td>
                  <td className="py-2 pr-4 text-text-dim">
                    {manifest.scoring.objective
                      ? OBJECTIVE_LABEL[manifest.scoring.objective.type]
                      : '—'}
                  </td>
                  <td className="py-2 pr-4 text-text-dim">
                    {manifest.scoring.subjective
                      ? manifest.scoring.subjective.dimensions
                          .map((d) => `${d.label} (${d.weight})`)
                          .join(', ')
                      : '—'}
                  </td>
                  <td className="py-2 pr-2 text-right text-text-dim">
                    {manifest.scoring.subjective?.pairwise ? 'yes' : 'no'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {prices && (
        <section className="mt-12">
          <h2 className="font-display text-2xl italic text-text">Price table</h2>
          <p className="mt-2 text-[15px] text-text-dim">
            {prices.unit}, {prices.currency}, as of {formatDate(prices.asOf)}. Every cost figure on
            this site is derived from this table at list price, not billed spend.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-[11px] uppercase tracking-[0.1em] text-text-faint">
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4 text-right">Input</th>
                  <th className="py-2 pr-4 text-right">Output</th>
                  <th className="py-2 pr-4 text-right">Cache read</th>
                  <th className="py-2 pr-4 text-right">Cache write</th>
                  <th className="py-2 pr-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(prices.models).map(([key, price]) => (
                  <tr key={key} className="border-b border-border">
                    <td className="py-2 pr-4 text-text" title={price.note || undefined}>
                      {price.vendorId}
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-text-dim">
                      {price.input === null ? '—' : `$${price.input}`}
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-text-dim">
                      {price.output === null ? '—' : `$${price.output}`}
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-text-dim">
                      {price.cacheRead === null ? '—' : `$${price.cacheRead}`}
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-text-dim">
                      {price.cacheWrite === null ? '—' : `$${price.cacheWrite}`}
                    </td>
                    <td className="py-2 pr-2">
                      <a
                        href={price.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline decoration-dotted underline-offset-4"
                      >
                        vendor pricing
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-display text-2xl italic text-text">Judge panel</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded border border-border p-4 text-sm">
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
              Configured (bench.config.json)
            </p>
            <ul className="mt-2 space-y-1 text-text-dim">
              {config.judges.map((j) => (
                <li key={j}>{j}</li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-border p-4 text-sm">
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
              Judged this release ({latest?.release ?? 'none yet'})
            </p>
            <ul className="mt-2 space-y-1 text-text-dim">
              {latest && latest.judges.length > 0 ? (
                latest.judges.map((j) => (
                  <li key={`${j.cli}-${j.model}`}>{`${j.cli}:${j.model}`}</li>
                ))
              ) : (
                <li>no release judged yet</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {knownLimits.length > 0 && (
        <section className="mt-12 border-t border-border pt-6">
          <h2 className="font-display text-xl italic text-text">Known limits, this release</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-[15px] leading-relaxed text-text-dim">
            {knownLimits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
