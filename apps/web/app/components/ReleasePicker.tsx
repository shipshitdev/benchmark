import type { Release } from '@benchmark/schema';
import Link from 'next/link';
import { formatDate } from '@/lib/format';

export function ReleasePicker({ releases, current }: { releases: Release[]; current: string }) {
  if (releases.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="uppercase tracking-[0.15em] text-text-faint">Releases</span>
      {releases.map((r) => (
        <Link
          key={r.release}
          href={`/releases/${r.release}/`}
          className={`rounded border px-2.5 py-1 tabular ${
            r.release === current
              ? 'border-accent text-accent'
              : 'border-border-strong text-text-dim hover:border-text-dim hover:text-text'
          }`}
          title={formatDate(r.generatedAt)}
        >
          {r.release}
        </Link>
      ))}
    </div>
  );
}
