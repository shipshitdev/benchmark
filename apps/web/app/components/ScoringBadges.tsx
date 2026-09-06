import type { ScoringBadge } from '@/lib/tests';

/** Small pill row naming which scoring layers apply to a task — gates, hidden tests, contract
 *  tests, checklist, rubric, pairwise — in the fixed order `scoringBadges()` returns them. */
export function ScoringBadges({ badges }: { badges: ScoringBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-text-dim"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}
