import type { RubricDimension } from '@benchmark/schema';
import type { LabeledItem } from './blindLabels';

export interface EvidenceRef {
  screenshots?: string[];
  diffPath?: string;
  reportPath?: string;
  transcriptSummary?: string;
}

export interface JudgePromptInput {
  taskTitle: string;
  rubricMarkdown: string;
  dimensions: RubricDimension[];
  pairwise: boolean;
  entries: LabeledItem<EvidenceRef>[];
}

function renderEntry({ label, item }: LabeledItem<EvidenceRef>): string {
  const lines = [`### Entry ${label}`];
  if (item.diffPath) lines.push(`Diff: ${item.diffPath}`);
  if (item.reportPath) lines.push(`Report: ${item.reportPath}`);
  if (item.transcriptSummary) lines.push(`Transcript summary: ${item.transcriptSummary}`);
  if (item.screenshots && item.screenshots.length > 0) {
    lines.push('Screenshots:');
    for (const path of item.screenshots) lines.push(`  - ${path}`);
  }
  return lines.join('\n');
}

/**
 * One judge prompt covering every blind-labelled entry for a task: the rubric verbatim, the
 * dimension list, each entry's evidence paths (the judge reads them with its own Read tool), and
 * the exact strict-JSON shape it must answer in.
 */
export function buildJudgePrompt(input: JudgePromptInput): string {
  const dimensionList = input.dimensions
    .map((dimension) => `- ${dimension.id} (${dimension.label}, weight ${dimension.weight})`)
    .join('\n');

  const scoreShape = input.entries
    .map(
      (entry) =>
        `  "${entry.label}": { "scores": { "<dimension id>": 0-4, ... }, "rationale": "" }`,
    )
    .join(',\n');

  const pairInstruction = input.pairwise
    ? '\nAlso return "pairs": an array covering every pair of entries, each ' +
      '{ "a": "<label>", "b": "<label>", "winner": "a"|"b"|"tie", "rationale": "" }.'
    : '';

  return [
    `Task: ${input.taskTitle}`,
    '',
    'Rubric:',
    input.rubricMarkdown,
    '',
    'Dimensions:',
    dimensionList,
    '',
    'Entries (blind-labelled; no model names attached):',
    input.entries.map(renderEntry).join('\n\n'),
    '',
    'Score every dimension 0-4 for every entry against the rubric anchors above. ' +
      'Respond with strict JSON only, no prose, no markdown fences, in exactly this shape:',
    '{',
    scoreShape,
    '}',
    pairInstruction,
  ].join('\n');
}
