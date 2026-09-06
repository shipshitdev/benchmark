import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { adapterFor } from '@benchmark/adapters';
import {
  type AgentSpec,
  type Caps,
  type Judgment,
  type PairwiseVerdict,
  parseAgentSpec,
  type RunResult,
} from '@benchmark/schema';
import type { Command } from 'commander';
import { loadConfig } from '../config';
import { assignBlindLabels, type LabeledItem } from '../judge/blindLabels';
import { parseChecklist, scoreChecklist } from '../judge/checklist';
import { buildEvidenceScratchDir, type EvidenceKind } from '../judge/evidence';
import { extractFirstJsonObject } from '../judge/jsonExtract';
import { buildJudgePrompt } from '../judge/promptBuilder';
import { scoreSubjective } from '../judge/subjectiveScore';
import { log } from '../log';
import { listRunResults, writeRunResult } from '../run/store';
import { type LoadedTask, loadTasks } from '../tasks/loader';
import { selectTasks } from '../tasks/select';

interface JudgeOptions {
  release: string;
  judges?: string;
  tasks?: string;
  dataDir?: string;
  tasksDir?: string;
}

const JUDGE_CAPS: Caps = { maxTurns: 20, maxBudgetUsd: 2, timeboxMinutes: 10 };

interface JudgeJsonScore {
  scores?: Record<string, number>;
  rationale?: string;
}

interface JudgePairJson {
  a?: string;
  b?: string;
  winner?: 'a' | 'b' | 'tie';
  rationale?: string;
}

interface JudgeResponseJson {
  pairs?: JudgePairJson[];
  [label: string]: JudgeJsonScore | JudgePairJson[] | undefined;
}

async function runJudgeAdapter(
  judge: AgentSpec,
  prompt: string,
  cwd: string,
  transcriptPath: string,
): Promise<{ finalText: string; usage: RunResult['usage']; version: string }> {
  const adapter = adapterFor(judge.cli);
  const version = await adapter.version();
  const output = await adapter.run({
    prompt,
    cwd,
    model: judge.model,
    ...(judge.effort ? { effort: judge.effort } : {}),
    caps: JUDGE_CAPS,
    transcriptPath,
    env: {},
    readOnly: true,
  });
  return {
    finalText: output.finalText,
    usage: {
      input: output.usage.input,
      output: output.usage.output,
      cacheRead: output.usage.cacheRead,
      cacheWrite: output.usage.cacheWrite,
      turns: output.usage.turns,
      toolCalls: output.usage.toolCalls,
      durationMs: output.usage.durationMs,
      costUsdEquivalent: null,
      ...(output.usage.reportedCostUsd !== undefined
        ? { reportedCostUsd: output.usage.reportedCostUsd }
        : {}),
    },
    version,
  };
}

async function judgeSubjective(
  dataDir: string,
  release: string,
  task: LoadedTask,
  judge: AgentSpec,
  okRuns: RunResult[],
  transcriptsDir: string,
): Promise<void> {
  const subjective = task.manifest.scoring.subjective;
  if (!subjective) return;

  const eligible = okRuns.filter((run) => run.agent.cli !== judge.cli);
  if (eligible.length === 0) return;

  const labeled = assignBlindLabels(eligible);
  const { scratchDir, entries } = await buildEvidenceScratchDir(
    dataDir,
    labeled,
    subjective.evidence as EvidenceKind[],
  );
  const rubricMarkdown = await Bun.file(join(task.dir, subjective.rubric)).text();
  const prompt = `${`Evidence files are in your working directory: ${scratchDir}\n\n`}${buildJudgePrompt(
    {
      taskTitle: task.manifest.title,
      rubricMarkdown,
      dimensions: subjective.dimensions,
      pairwise: subjective.pairwise,
      entries,
    },
  )}`;

  const transcriptPath = join(
    transcriptsDir,
    `${task.manifest.id.replace('/', '--')}--${judge.cli}.jsonl`,
  );
  const { finalText, usage, version } = await runJudgeAdapter(
    judge,
    prompt,
    scratchDir,
    transcriptPath,
  );
  const parsed = extractFirstJsonObject(finalText) as JudgeResponseJson | undefined;
  if (!parsed) {
    log.warn(
      `${task.manifest.id}: judge ${judge.cli}:${judge.model} returned no parseable JSON: ${finalText.slice(0, 160).replace(/\s+/g, ' ')}`,
    );
    return;
  }

  const labelToRun = new Map(labeled.map(({ label, item }) => [label, item]));

  for (const { label } of labeled) {
    const run = labelToRun.get(label);
    const entry = parsed[label] as JudgeJsonScore | undefined;
    if (!run || !entry?.scores) continue;

    const judgment: Judgment = {
      judge: { cli: judge.cli, model: judge.model, version },
      blindLabel: label,
      scores: entry.scores,
      subjective: scoreSubjective(entry.scores, subjective.dimensions),
      rationale: entry.rationale ?? '',
      usage,
    };

    const judgments = run.judgments.filter(
      (existing) => !(existing.judge.cli === judge.cli && existing.judge.model === judge.model),
    );
    judgments.push(judgment);
    run.judgments = judgments;
    await writeRunResult(dataDir, run);
  }

  if (subjective.pairwise && Array.isArray(parsed.pairs)) {
    const pairwisePath = join(dataDir, 'releases', `${release}.pairwise.jsonl`);
    await mkdir(join(dataDir, 'releases'), { recursive: true });
    const lines: string[] = [];
    for (const pair of parsed.pairs) {
      const a = pair.a ? labelToRun.get(pair.a) : undefined;
      const b = pair.b ? labelToRun.get(pair.b) : undefined;
      if (!a || !b || !pair.winner) continue;
      const verdict: PairwiseVerdict = {
        task: task.manifest.id,
        judge: { cli: judge.cli, model: judge.model },
        a: a.id,
        b: b.id,
        winner: pair.winner,
        rationale: pair.rationale ?? '',
      };
      lines.push(JSON.stringify(verdict));
    }
    if (lines.length > 0) {
      await appendFile(pairwisePath, `${lines.join('\n')}\n`);
    }
  }
}

async function judgeChecklist(
  dataDir: string,
  task: LoadedTask,
  judges: AgentSpec[],
  okRuns: RunResult[],
  transcriptsDir: string,
): Promise<void> {
  const objective = task.manifest.scoring.objective;
  if (objective?.type !== 'checklist') return;

  const items = parseChecklist(await Bun.file(join(task.dir, objective.checklist)).text());

  for (const run of okRuns) {
    if (run.objective !== null) continue;
    if (!run.artifacts.report) continue;
    const judge = judges.find((candidate) => candidate.cli !== run.agent.cli);
    if (!judge) continue;

    const labeled: Array<LabeledItem<RunResult>> = [{ label: 'A', item: run }];
    const { scratchDir, entries } = await buildEvidenceScratchDir(dataDir, labeled, ['report']);
    const reportEntry = entries[0]?.item;
    const prompt = [
      `Task: ${task.manifest.title}`,
      '',
      'Checklist (planted issues to look for):',
      ...items.map((item) => `- ${item.id}: ${item.description}`),
      '',
      `The agent's report is at: ${reportEntry?.reportPath ?? '(no report found)'}`,
      '',
      'Map each checklist item to evidence in the report. Respond with strict JSON only:',
      '{ "found": ["<checklist item id>", ...], "unsupported": <number of findings not on the checklist> }',
    ].join('\n');

    const transcriptPath = join(
      transcriptsDir,
      `${task.manifest.id.replace('/', '--')}--checklist--${run.attempt}--${judge.cli}.jsonl`,
    );
    const { finalText } = await runJudgeAdapter(judge, prompt, scratchDir, transcriptPath);
    const parsed = extractFirstJsonObject(finalText) as
      | { found?: string[]; unsupported?: number }
      | undefined;
    if (!parsed) {
      log.warn(`${run.id}: checklist judge returned no parseable JSON`);
      continue;
    }

    const score = scoreChecklist(
      items,
      parsed.found ?? [],
      parsed.unsupported ?? 0,
      objective.hallucinationPenalty,
    );
    await writeRunResult(dataDir, { ...run, objective: score });
  }
}

export function registerJudge(program: Command): void {
  program
    .command('judge')
    .description(
      'blind-label and score every ok run whose task has subjective or checklist scoring',
    )
    .requiredOption('--release <name>', 'release to judge')
    .option(
      '--judges <specs>',
      'comma-separated cli:model[@effort] judge specs, overrides bench.config.json',
    )
    .option('--tasks <selector>', 'all, or a comma-separated list of task ids', 'all')
    .option('--data-dir <dir>', 'override the configured data directory')
    .option('--tasks-dir <dir>', 'override the configured tasks directory')
    .action(async (options: JudgeOptions) => {
      const { config, dataDir, tasksDir } = await loadConfig(process.cwd(), {
        dataDir: options.dataDir,
        tasksDir: options.tasksDir,
      });
      const { tasks, errors } = await loadTasks(tasksDir);
      if (errors.length > 0) {
        log.error(`${errors.length} task(s) fail validation; run "bench validate" for detail.`);
        process.exitCode = 1;
        return;
      }

      const judgeSpecs = (options.judges ? options.judges.split(',') : config.judges)
        .map((spec) => spec.trim())
        .filter((spec) => spec.length > 0)
        .map(parseAgentSpec);
      if (judgeSpecs.length === 0) {
        log.warn('no judges configured');
        return;
      }

      const selectedTasks = selectTasks(tasks, options.tasks ?? 'all');
      const allRuns = await listRunResults(dataDir, options.release);
      const transcriptsDir = join(dataDir, 'releases', options.release, 'judging');
      await mkdir(transcriptsDir, { recursive: true });

      for (const task of selectedTasks) {
        const okRuns = allRuns.filter(
          (run) => run.task === task.manifest.id && run.status === 'ok',
        );
        if (okRuns.length === 0) continue;

        if (task.manifest.scoring.subjective) {
          for (const judge of judgeSpecs) {
            await judgeSubjective(dataDir, options.release, task, judge, okRuns, transcriptsDir);
          }
          log.info(`${task.manifest.id}: ${okRuns.length} run(s) offered to the judge panel`);
        }

        if (task.manifest.scoring.objective?.type === 'checklist') {
          await judgeChecklist(dataDir, task, judgeSpecs, okRuns, transcriptsDir);
          log.info(`${task.manifest.id}: scored checklist objective`);
        }
      }
    });
}
