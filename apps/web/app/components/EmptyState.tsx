import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">no release yet</p>
      <h1 className="mt-4 font-display text-4xl italic text-text">The bench is warm, not run.</h1>
      <p className="mt-6 text-sm leading-relaxed text-text-dim">
        This site publishes results the moment a frontier model release finishes a run: the same
        twenty-task suite, driven through the CLI coding agents people actually pay for (Claude
        Code, Codex CLI, Grok Build, Cursor), scored on deterministic gates, hidden tests and blind
        rubric judging. Every score carries tokens, turns, wall time and an API-equivalent cost, and
        every number links back to the transcript and diff it came from.
      </p>
      <p className="mt-6 text-sm text-text-dim">
        Read the{' '}
        <Link href="/methodology/" className="text-accent underline underline-offset-4">
          methodology
        </Link>{' '}
        for the full task suite, scoring model and judge panel.
      </p>
    </div>
  );
}
