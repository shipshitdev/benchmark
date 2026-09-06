import Link from 'next/link';
import type { ReactNode } from 'react';

/** Wraps a rendered number so it links back to the run it was measured from — every figure on
 *  this site must be traceable to a `runs/<run-id>/result.json`. */
export function RunLink({ runId, children }: { runId: string; children: ReactNode }) {
  return (
    <Link
      href={`/runs/${runId}/`}
      className="tabular underline decoration-dotted decoration-text-faint underline-offset-4 hover:text-accent hover:decoration-accent"
      title={`Source run: ${runId}`}
    >
      {children}
    </Link>
  );
}
