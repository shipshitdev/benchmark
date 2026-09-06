/**
 * Presentation logic for the `/tests/` section: the one-line question each task answers (product
 * copy, not derivable from `task.yaml`), and pure derivations over a loaded task's manifest.
 */
import {
  agentSlug,
  type Category,
  type Gate,
  type Release,
  type TaskId,
  taskSlug,
} from '@benchmark/schema';
import type { LoadedTask } from './data';
import { formatAgentLabel } from './format';

/** The question each task is designed to answer, one line, in the suite's own words. */
export const TASK_QUESTIONS: Record<string, string> = {
  'ux-ui/pricing-page': 'Can it design, not just code?',
  'frontend/issue-board-filters': 'Can it extend an existing app in its own conventions?',
  'backend/inventory-api': 'Can it build a service to a contract?',
  'planning-audit/planted-defects': 'Can it read a codebase critically and plan?',
  'bugfix/date-range-overlap': 'Can it fix a reported bug without breaking anything?',
  'signature/landing-hero': 'The same visual brief every release.',
};

export type ScoringBadge =
  | 'gates'
  | 'hidden tests'
  | 'contract tests'
  | 'checklist'
  | 'rubric'
  | 'pairwise';

/** Which scoring layers apply to a task, in a fixed display order, derived straight from the
 *  manifest so a new task shows the right badges without a copy update. */
export function scoringBadges(manifest: LoadedTask['manifest']): ScoringBadge[] {
  const badges: ScoringBadge[] = [];
  if (manifest.gates.length > 0) badges.push('gates');
  const objective = manifest.scoring.objective;
  if (objective) {
    switch (objective.type) {
      case 'playwright-pass-rate':
      case 'hidden-tests':
        badges.push('hidden tests');
        break;
      case 'http-contract-pass-rate':
        badges.push('contract tests');
        break;
      case 'checklist':
        badges.push('checklist');
        break;
    }
  }
  if (manifest.scoring.subjective) {
    badges.push('rubric');
    if (manifest.scoring.subjective.pairwise) badges.push('pairwise');
  }
  return badges;
}

export type TaskLeader = { agentLabel: string; agentSlug: string; score: number };

/** The highest-scoring agent on this task in a release, or null when no cell has a score yet. */
export function leaderForTask(release: Release, taskId: TaskId): TaskLeader | null {
  const scored = release.cells
    .filter((cell) => cell.task === taskId && cell.score !== null)
    .map((cell) => ({
      agentLabel: formatAgentLabel(cell.agent),
      agentSlug: agentSlug(cell.agent),
      // biome-ignore lint/style/noNonNullAssertion: filtered on cell.score !== null above
      score: cell.score!.mean,
    }));
  if (scored.length === 0) return null;
  return scored.reduce((best, cur) => (cur.score > best.score ? cur : best));
}

/** One plain sentence per gate, in the order `task.yaml` lists them — exhaustive over `Gate`'s
 *  discriminated union so a new gate type is a compile error here until it gets a sentence. */
export function gateSentence(gate: Gate): string {
  switch (gate.type) {
    case 'command':
      return `Runs \`${gate.run}\` and must exit 0.`;
    case 'playwright':
      return 'Serves the app and runs a Playwright spec that must pass before scoring continues.';
    case 'axe':
      return `Serves the app and scans ${gate.paths.join(', ')} for accessibility violations, failing on ${gate.failOn} impact or worse.`;
    case 'http-contract':
      return 'Serves the app and runs a contract test suite against it that must pass before scoring continues.';
  }
}

/** One representative task slug per category in a release, for linking a leaderboard column
 *  header straight to that category's test page. The current suite has exactly one task per
 *  category; a future multi-task category still links somewhere sensible (its first task). */
export function firstTaskSlugByCategory(release: Release): Partial<Record<Category, string>> {
  const map: Partial<Record<Category, string>> = {};
  for (const task of release.tasks) {
    if (!map[task.category]) map[task.category] = taskSlug(task.id);
  }
  return map;
}
