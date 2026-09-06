import { parse as parseYaml } from 'yaml';

export interface ChecklistItem {
  id: string;
  description: string;
}

/**
 * `task.yaml`'s `scoring.objective.checklist` file: a YAML list of `{ id, summary | description }`,
 * optionally with `file`, which is folded into the description so the judge can match by location.
 */
export function parseChecklist(yaml: string): ChecklistItem[] {
  const parsed = parseYaml(yaml);
  if (!Array.isArray(parsed)) throw new Error('checklist file must be a YAML list');
  return parsed.map((entry, index) => {
    const text = typeof entry?.summary === 'string' ? entry.summary : entry?.description;
    if (typeof entry?.id !== 'string' || typeof text !== 'string') {
      throw new Error(
        `checklist item ${index} must have string "id" and "summary" or "description"`,
      );
    }
    const description =
      typeof entry.file === 'string' ? `${entry.file}: ${text.trim()}` : text.trim();
    return { id: entry.id, description };
  });
}

/**
 * Planted-issue recall, per the schema comment on `ObjectiveScoring`'s `checklist` variant:
 * `recall * 100 - hallucinationPenalty * unsupported`, floored at 0. `found` ids not on the
 * checklist are dropped rather than credited, so a judge cannot inflate recall by inventing ids.
 */
export function scoreChecklist(
  items: ChecklistItem[],
  found: string[],
  unsupported: number,
  hallucinationPenalty: number,
): number {
  if (items.length === 0) return 0;
  const validIds = new Set(items.map((item) => item.id));
  const matched = new Set(found.filter((id) => validIds.has(id)));
  const recall = matched.size / items.length;
  return Math.max(0, recall * 100 - hallucinationPenalty * unsupported);
}
