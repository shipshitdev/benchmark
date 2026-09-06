import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { adapterFor } from '@benchmark/adapters';
import {
  type AgentSpec,
  parseAgentSpec,
  RunResult,
  runId,
  type TaskManifest,
} from '@benchmark/schema';
import type { Command } from 'commander';
import { loadConfig } from '../config';
import { log } from '../log';
import { computeCost, loadPriceTable } from '../prices';
import { runGates } from '../run/gates';
import { scoreObjective } from '../run/objective';
import { resultPath, runDir, shouldSkipRun } from '../run/resume';
import { captureScreenshots } from '../run/screenshots';
import { captureDiff, createWorkspace } from '../run/workspace';
import { type LoadedTask, loadTasks } from '../tasks/loader';
import { selectTasks } from '../tasks/select';

interface RunOptions {
  release: string;
  agents: string;
  tasks: string;
  repeat?: string;
  force?: boolean;
  onlyAttempt?: string;
  dataDir?: string;
  tasksDir?: string;
}

function reportPathFor(manifest: TaskManifest): string | undefined {
  if (manifest.scoring.subjective?.report) return manifest.scoring.subjective.report;
  if (manifest.scoring.objective?.type === 'checklist') return manifest.scoring.objective.report;
  return undefined;
}

async function runOnce(
  release: string,
  suiteVersion: string,
  task: LoadedTask,
  agent: AgentSpec,
  attempt: number,
  repoRoot: string,
  dataDir: string,
): Promise<void> {
  const id = runId(release, task.manifest.id, agent, attempt);
  const runDirectory = runDir(dataDir, id);
  const workspaceDir = join(repoRoot, '.runs', id, 'workspace');
  const gatesLogDir = join(runDirectory, 'gates');
  const rawTranscriptPath = join(repoRoot, '.runs', id, 'transcript.jsonl');
  const startedAt = new Date();

  await mkdir(runDirectory, { recursive: true });
  await mkdir(gatesLogDir, { recursive: true });

  const fixtureDir = task.manifest.fixture ? join(task.dir, task.manifest.fixture) : undefined;
  await createWorkspace(fixtureDir, workspaceDir);

  const prompt = await Bun.file(join(task.dir, task.manifest.prompt)).text();
  const adapter = adapterFor(agent.cli);
  const version = await adapter.version();

  const env: Record<string, string> = {};
  if (process.env.CLAUDE_CONFIG_DIR) env.CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR;
  if (process.env.GROK_HOME) env.GROK_HOME = process.env.GROK_HOME;

  const output = await adapter.run({
    prompt,
    cwd: workspaceDir,
    model: agent.model,
    ...(agent.effort ? { effort: agent.effort } : {}),
    caps: task.manifest.caps,
    transcriptPath: rawTranscriptPath,
    env,
  });

  const diff = await captureDiff(workspaceDir);
  await Bun.write(join(runDirectory, 'diff.patch'), diff);

  const transcriptText = (await Bun.file(rawTranscriptPath).exists())
    ? await Bun.file(rawTranscriptPath).text()
    : '';
  await Bun.write(
    join(runDirectory, 'transcript.jsonl.gz'),
    Bun.gzipSync(Buffer.from(transcriptText)),
  );
  await rm(rawTranscriptPath, { force: true });

  let status: RunResult['status'] = output.status === 'ok' ? 'ok' : output.status;
  const gates =
    status === 'ok' ? await runGates(task.manifest.gates, task.dir, workspaceDir, gatesLogDir) : [];
  if (status === 'ok' && gates.some((gate) => !gate.pass)) status = 'gate_failed';

  let objective: number | null = null;
  const notes = [...output.notes];
  if (status === 'ok' && task.manifest.scoring.objective) {
    const result = await scoreObjective(task.manifest.scoring.objective, task.dir, workspaceDir);
    objective = result.score;
    if (result.note) notes.push(result.note);
  }

  const screenshots =
    status === 'ok' && task.manifest.artifacts.screenshots.length > 0
      ? await captureScreenshots(
          task.manifest.artifacts.screenshots,
          workspaceDir,
          join(runDirectory, 'screenshots'),
        )
      : [];

  // `artifacts.report` is documented as relative to the run directory, but the agent writes it
  // into its (ephemeral, gitignored) workspace; copy it out so it survives and evidence-building
  // in "bench judge" never has to reach back into `.runs/`.
  const reportRelativePath = reportPathFor(task.manifest);
  let report: string | null = null;
  if (reportRelativePath && existsSync(join(workspaceDir, reportRelativePath))) {
    const destination = join(runDirectory, reportRelativePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(workspaceDir, reportRelativePath), destination);
    report = reportRelativePath;
  }

  const prices = await loadPriceTable(dataDir);
  const cost = computeCost(agent.model, output.usage, prices);
  if (cost.note) notes.push(cost.note);

  const result: RunResult = {
    id,
    release,
    suiteVersion,
    task: task.manifest.id,
    taskVersion: task.manifest.version,
    agent: {
      cli: agent.cli,
      model: agent.model,
      ...(agent.effort ? { effort: agent.effort } : {}),
      version,
      permissionMode: output.permissionMode,
      caps: task.manifest.caps,
      command: output.command,
    },
    attempt,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    host: process.env.HOSTNAME ?? 'unknown-host',
    status,
    usage: {
      input: output.usage.input,
      output: output.usage.output,
      cacheRead: output.usage.cacheRead,
      cacheWrite: output.usage.cacheWrite,
      turns: output.usage.turns,
      toolCalls: output.usage.toolCalls,
      durationMs: output.usage.durationMs,
      costUsdEquivalent: cost.costUsdEquivalent,
      ...(output.usage.reportedCostUsd !== undefined
        ? { reportedCostUsd: output.usage.reportedCostUsd }
        : {}),
      ...(cost.priceKey ? { priceKey: cost.priceKey } : {}),
    },
    gates,
    objective,
    judgments: [],
    artifacts: {
      transcript: 'transcript.jsonl.gz',
      diff: 'diff.patch',
      screenshots: screenshots.map((screenshot) => ({
        path: screenshot.path,
        viewport: screenshot.viewport,
        file: join('screenshots', screenshot.file),
      })),
      report,
    },
    notes,
  };

  const validated = RunResult.parse(result);
  await Bun.write(resultPath(dataDir, id), JSON.stringify(validated, null, 2));
  log.info(`${id}: ${status}${objective !== null ? ` objective=${objective.toFixed(1)}` : ''}`);
}

export function registerRun(program: Command): void {
  program
    .command('run')
    .description('run the task suite through the given agents and score deterministic gates')
    .requiredOption('--release <name>', 'release name this run belongs to, e.g. v2026.09')
    .requiredOption('--agents <specs>', 'comma-separated cli:model[@effort] agent specs')
    .option('--tasks <selector>', 'all, or a comma-separated list of task ids', 'all')
    .option('--repeat <n>', 'attempts per (task, agent); overrides bench.config.json')
    .option('--force', 'rerun even if data/runs/<id>/result.json already exists')
    .option('--only-attempt <k>', 'run only this attempt number')
    .option('--data-dir <dir>', 'override the configured data directory')
    .option('--tasks-dir <dir>', 'override the configured tasks directory')
    .action(async (options: RunOptions) => {
      const { config, repoRoot, dataDir, tasksDir } = await loadConfig(process.cwd(), {
        dataDir: options.dataDir,
        tasksDir: options.tasksDir,
      });
      const { tasks, errors } = await loadTasks(tasksDir);
      if (errors.length > 0) {
        log.error(`${errors.length} task(s) fail validation; run "bench validate" for detail.`);
        process.exitCode = 1;
        return;
      }

      const selectedTasks = selectTasks(tasks, options.tasks);
      if (selectedTasks.length === 0) {
        log.warn(`no tasks matched "${options.tasks}"`);
        return;
      }

      const agents = options.agents.split(',').map((spec) => parseAgentSpec(spec.trim()));
      const repeat = options.repeat ? Number(options.repeat) : config.repeat;
      const attempts = options.onlyAttempt ? [Number(options.onlyAttempt)] : range(1, repeat);

      for (const task of selectedTasks) {
        for (const agent of agents) {
          for (const attempt of attempts) {
            const id = runId(options.release, task.manifest.id, agent, attempt);
            if (shouldSkipRun(dataDir, id, Boolean(options.force))) {
              log.info(`${id}: skipped (already has a result; pass --force to rerun)`);
              continue;
            }
            await runOnce(
              options.release,
              config.suiteVersion,
              task,
              agent,
              attempt,
              repoRoot,
              dataDir,
            );
          }
        }
      }
    });
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}
