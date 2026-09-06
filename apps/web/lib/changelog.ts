/** Pure changelog assembly from releases and tasks — one entry per release, one per task, sorted
 *  newest first by an ISO date so the page component only has to render the list. */
import type { Release } from '@benchmark/schema';
import type { LoadedTask } from './data';

export type ChangelogEntry = { date: string; text: string };

export function buildChangelog(releases: Release[], tasks: LoadedTask[]): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [
    ...releases.map((r) => ({
      date: r.generatedAt,
      text: `${r.release} published — ${r.agents.length} agents, ${r.tasks.length} tasks.`,
    })),
    ...tasks.map((t) => ({
      date: `${t.manifest.authored}T00:00:00.000Z`,
      text: `Task added: ${t.manifest.title} (${t.manifest.category}).`,
    })),
  ];
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}
