import { cp, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ObjectiveScoring } from '@benchmark/schema';
import { parseJunit } from '../aggregate/junit';
import { parsePlaywrightJson } from '../aggregate/playwrightJson';
import { runWithTimeout } from './gates';
import { startServe } from './serve';

export interface ObjectiveResult {
  /** 0..100, or null when the run can't be scored (e.g. checklist scoring, done separately in `judge`). */
  score: number | null;
  note?: string;
}

async function copyIntoWorkspace(
  taskDir: string,
  workspaceDir: string,
  relativePath: string,
): Promise<void> {
  const destination = join(workspaceDir, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(taskDir, relativePath), destination, { recursive: true });
}

async function scorePlaywrightPassRate(
  objective: Extract<ObjectiveScoring, { type: 'playwright-pass-rate' }>,
  taskDir: string,
  workspaceDir: string,
): Promise<ObjectiveResult> {
  const specDest = join(workspaceDir, '__bench_objective__', 'playwright.spec.ts');
  await mkdir(dirname(specDest), { recursive: true });
  await cp(join(taskDir, objective.spec), specDest);

  const serveHandle = await startServe(objective.serve, workspaceDir);
  try {
    const env = { ...process.env, BASE_URL: serveHandle.baseUrl } as Record<string, string>;
    const { output } = await runWithTimeout(
      ['bunx', 'playwright', 'test', specDest, '--reporter=json'],
      workspaceDir,
      env,
      objective.timeoutSeconds,
    );
    const summary = parsePlaywrightJson(output);
    return { score: summary.passRate * 100 };
  } catch (error) {
    return {
      score: null,
      note: `playwright-pass-rate scoring failed: ${(error as Error).message}`,
    };
  } finally {
    await serveHandle.stop();
  }
}

async function scoreHttpContractPassRate(
  objective: Extract<ObjectiveScoring, { type: 'http-contract-pass-rate' }>,
  taskDir: string,
  workspaceDir: string,
): Promise<ObjectiveResult> {
  const specDest = join(workspaceDir, '__bench_objective__', 'http-contract.test.ts');
  await mkdir(dirname(specDest), { recursive: true });
  await cp(join(taskDir, objective.spec), specDest);
  const junitPath = join(workspaceDir, '__bench_objective__', 'http-contract.junit.xml');

  const serveHandle = await startServe(objective.serve, workspaceDir);
  try {
    const env = { ...process.env, BASE_URL: serveHandle.baseUrl } as Record<string, string>;
    await runWithTimeout(
      ['bun', 'test', specDest, '--reporter=junit', `--reporter-outfile=${junitPath}`],
      workspaceDir,
      env,
      objective.timeoutSeconds,
    );
    const xml = await Bun.file(junitPath).text();
    return { score: parseJunit(xml).passRate * 100 };
  } catch (error) {
    return {
      score: null,
      note: `http-contract-pass-rate scoring failed: ${(error as Error).message}`,
    };
  } finally {
    await serveHandle.stop();
  }
}

async function scoreHiddenTests(
  objective: Extract<ObjectiveScoring, { type: 'hidden-tests' }>,
  taskDir: string,
  workspaceDir: string,
): Promise<ObjectiveResult> {
  for (const file of objective.files) {
    await copyIntoWorkspace(taskDir, workspaceDir, file);
  }
  const junitDir = await mkdtemp(join(tmpdir(), 'bench-hidden-tests-'));
  const junitPath = join(junitDir, 'results.xml');
  try {
    // `run` is expected to be a `bun test` invocation; the harness appends its own junit reporter
    // flags so it can compute a pass rate without every task author wiring that up by hand.
    const command = `${objective.run} --reporter=junit --reporter-outfile=${junitPath}`;
    await runWithTimeout(
      ['sh', '-c', command],
      workspaceDir,
      process.env as Record<string, string>,
      objective.timeoutSeconds,
    );
    const xml = await Bun.file(junitPath).text();
    return { score: parseJunit(xml).passRate * 100 };
  } catch (error) {
    return { score: null, note: `hidden-tests scoring failed: ${(error as Error).message}` };
  }
}

/**
 * Dispatches a task's `scoring.objective`. `checklist` is scored by a judge (planted-issue
 * recall needs a model to map findings to evidence), so it always comes back null here with a
 * note; `bench judge` fills the real value in.
 */
export async function scoreObjective(
  objective: ObjectiveScoring,
  taskDir: string,
  workspaceDir: string,
): Promise<ObjectiveResult> {
  switch (objective.type) {
    case 'playwright-pass-rate':
      return scorePlaywrightPassRate(objective, taskDir, workspaceDir);
    case 'http-contract-pass-rate':
      return scoreHttpContractPassRate(objective, taskDir, workspaceDir);
    case 'hidden-tests':
      return scoreHiddenTests(objective, taskDir, workspaceDir);
    case 'checklist':
      return { score: null, note: 'checklist objective scoring happens in "bench judge"' };
  }
}
