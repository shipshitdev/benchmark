import type { Metadata } from 'next';
import Link from 'next/link';
import { ScoringBadges } from '@/app/components/ScoringBadges';
import { getLatestRelease, loadTasks } from '@/lib/data';
import { formatCategory, formatScore } from '@/lib/format';
import { pageMetadata } from '@/lib/site';
import { leaderForTask, scoringBadges, TASK_QUESTIONS } from '@/lib/tests';

export const metadata: Metadata = pageMetadata({
  title: `Tests`,
  description:
    'The six-task suite, one card per task: what it tests, how it is scored, and who leads it.',
  path: '/tests/',
});

export default function TestsIndexPage() {
  const tasks = loadTasks();
  const latest = getLatestRelease();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">the suite</p>
      <h1 className="mt-2 font-display text-4xl italic text-text">Six tasks</h1>
      <p className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-text-dim">
        One task per category, each asking a different question about what a coding agent can
        actually do. Every task page below has the verbatim prompt, the fixture it starts from, and
        every score it has produced across releases.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map(({ manifest, slug }) => {
          const leader = latest ? leaderForTask(latest, manifest.id) : null;
          return (
            <Link
              key={manifest.id}
              href={`/tests/${slug}/`}
              className="group flex flex-col justify-between rounded border border-border p-5 hover:border-accent"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                  {formatCategory(manifest.category)}
                </p>
                <h2 className="mt-2 font-display text-xl italic text-text group-hover:text-accent">
                  {manifest.title}
                </h2>
                <p className="mt-2 text-[15px] text-text-dim">
                  {TASK_QUESTIONS[manifest.id] ?? manifest.summary}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <ScoringBadges badges={scoringBadges(manifest)} />
                <p className="text-xs text-text-faint">
                  {leader ? (
                    <>
                      Leader: <span className="text-text">{leader.agentLabel}</span>{' '}
                      <span className="tabular">{formatScore(leader.score)}</span>
                    </>
                  ) : (
                    'No score yet'
                  )}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
