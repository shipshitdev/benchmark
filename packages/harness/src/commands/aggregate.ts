import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type AgentSpec,
  agentSlug,
  type Cell,
  type PairwiseVerdict,
  parseAgentSpec,
  Release,
  type RunResult,
  type Standing,
  type UsageTotals,
} from '@benchmark/schema';
import type { Command } from 'commander';
import {
  type BradleyTerryRating,
  bradleyTerry,
  type PairwiseComparison,
} from '../aggregate/bradleyTerry';
import { buildCell, buildUsageTotals } from '../aggregate/cellAggregate';
import { loadConfig } from '../config';
import { log } from '../log';
import { loadPriceTable } from '../prices';
import { listRunResults } from '../run/store';
import { loadTasks } from '../tasks/loader';

interface AggregateOptions {
  release: string;
  dataDir?: string;
  tasksDir?: string;
}

function agentKey(agent: Pick<AgentSpec, 'cli' | 'model' | 'effort'>): string {
  return agentSlug({
    cli: agent.cli,
    model: agent.model,
    ...(agent.effort ? { effort: agent.effort } : {}),
  });
}

async function loadPairwiseVerdicts(dataDir: string, release: string): Promise<PairwiseVerdict[]> {
  const path = join(dataDir, 'releases', `${release}.pairwise.jsonl`);
  const file = Bun.file(path);
  if (!(await file.exists())) return [];
  const text = await file.text();
  const verdicts: PairwiseVerdict[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    verdicts.push(JSON.parse(line));
  }
  return verdicts;
}

function telemetryOf(usage: UsageTotals): 'full' | 'partial' | 'none' {
  const fields = [
    usage.input,
    usage.output,
    usage.cacheRead,
    usage.cacheWrite,
    usage.turns,
    usage.toolCalls,
  ];
  const present = fields.filter((value) => value !== null).length;
  if (present === fields.length) return 'full';
  if (present === 0) return 'none';
  return 'partial';
}

export function combineCategory(cellScoreMeans: number[]): number | null {
  return cellScoreMeans.length > 0
    ? cellScoreMeans.reduce((sum, value) => sum + value, 0) / cellScoreMeans.length
    : null;
}

export function combineOverall(
  categoryScores: Array<{ category: string; score: number | null }>,
  weights: Record<string, number>,
): number | null {
  const parts = categoryScores
    .filter((entry) => entry.score !== null && (weights[entry.category] ?? 0) > 0)
    .map((entry) => ({ score: entry.score as number, weight: weights[entry.category] as number }));
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (parts.length === 0 || totalWeight === 0) return null;
  return parts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight;
}

export function registerAggregate(program: Command): void {
  program
    .command('aggregate')
    .description('build data/releases/<release>.json from every run and judgment recorded so far')
    .requiredOption('--release <name>', 'release to aggregate')
    .option('--data-dir <dir>', 'override the configured data directory')
    .option('--tasks-dir <dir>', 'override the configured tasks directory')
    .action(async (options: AggregateOptions) => {
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

      const runs = await listRunResults(dataDir, options.release);
      if (runs.length === 0) {
        log.warn(`no runs found for release "${options.release}"`);
      }
      const notes: string[] = [];

      const prices = await loadPriceTable(dataDir);
      const pricesAsOf = prices?.asOf ?? new Date().toISOString().slice(0, 10);
      if (!prices) notes.push('data/prices.json not found; costs and score-per-dollar are null');

      const agentsByKey = new Map<string, AgentSpec>();
      const runsByKey = new Map<string, RunResult[]>();
      for (const run of runs) {
        const key = agentKey(run.agent);
        agentsByKey.set(key, {
          cli: run.agent.cli,
          model: run.agent.model,
          ...(run.agent.effort ? { effort: run.agent.effort } : {}),
        });
        const bucket = runsByKey.get(key) ?? [];
        bucket.push(run);
        runsByKey.set(key, bucket);
      }

      const cells = tasks.flatMap((task) =>
        [...agentsByKey.entries()]
          .map(([key, agent]) => {
            const taskRuns = (runsByKey.get(key) ?? []).filter(
              (run) => run.task === task.manifest.id,
            );
            return taskRuns.length > 0
              ? buildCell(task.manifest.id, agent, taskRuns, task.manifest.scoring.weights)
              : undefined;
          })
          .filter((cell): cell is Cell => cell !== undefined),
      );

      const standings: Standing[] = [...agentsByKey.entries()].map(([key, agent]) => {
        const categoryScores = Array.from(new Set(tasks.map((task) => task.manifest.category))).map(
          (category) => {
            const tasksInCategory = tasks.filter((task) => task.manifest.category === category);
            const categoryCells = cells.filter(
              (cell) =>
                agentKey(cell.agent) === key &&
                tasksInCategory.some((task) => task.manifest.id === cell.task),
            );
            const means = categoryCells
              .map((cell) => cell.score?.mean)
              .filter((value): value is number => value !== undefined);
            return {
              category,
              agent,
              score: combineCategory(means),
              tasks: tasksInCategory.length,
            };
          },
        );

        const overall = combineOverall(categoryScores, config.categoryWeights);
        const usage = buildUsageTotals(runsByKey.get(key) ?? []);
        const scorePerDollar =
          overall !== null && usage.costUsdEquivalent !== null && usage.costUsdEquivalent > 0
            ? overall / usage.costUsdEquivalent
            : null;

        return {
          agent,
          overall,
          categories: categoryScores,
          usage,
          scorePerDollar,
          telemetry: telemetryOf(usage),
        };
      });

      const pairwiseVerdicts = await loadPairwiseVerdicts(dataDir, options.release);
      const runAgentKey = new Map(runs.map((run) => [run.id, agentKey(run.agent)]));
      const pairwise = tasks
        .map((task) => {
          const taskVerdicts = pairwiseVerdicts.filter(
            (verdict) => verdict.task === task.manifest.id,
          );
          if (taskVerdicts.length === 0) return undefined;

          const comparisons: PairwiseComparison[] = taskVerdicts
            .map((verdict) => {
              const a = runAgentKey.get(verdict.a);
              const b = runAgentKey.get(verdict.b);
              return a && b ? { a, b, winner: verdict.winner } : undefined;
            })
            .filter((comparison): comparison is PairwiseComparison => comparison !== undefined);

          const items = [
            ...new Set(comparisons.flatMap((comparison) => [comparison.a, comparison.b])),
          ];
          const ratings = bradleyTerry(items, comparisons);
          return {
            task: task.manifest.id,
            ratings: ratings.map((rating: BradleyTerryRating) => ({
              agent: agentsByKey.get(rating.item) as AgentSpec,
              rating: rating.rating,
              ciLow: rating.ciLow,
              ciHigh: rating.ciHigh,
              comparisons: rating.comparisons,
            })),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

      const release = Release.parse({
        release: options.release,
        title: options.release,
        suiteVersion: config.suiteVersion,
        generatedAt: new Date().toISOString(),
        pricesAsOf,
        categoryWeights: config.categoryWeights,
        agents: [...agentsByKey.values()],
        tasks: tasks.map((task) => ({
          id: task.manifest.id,
          category: task.manifest.category,
          title: task.manifest.title,
          version: task.manifest.version,
        })),
        cells,
        standings,
        pairwise,
        judges: config.judges.map((spec) => {
          const parsed = parseAgentSpec(spec);
          return { cli: parsed.cli, model: parsed.model };
        }),
        notes,
      });

      await mkdir(join(dataDir, 'releases'), { recursive: true });
      const outputPath = join(dataDir, 'releases', `${options.release}.json`);
      await Bun.write(outputPath, JSON.stringify(release, null, 2));
      log.info(`wrote ${outputPath}`);
    });
}
