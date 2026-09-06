import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RunId } from '@benchmark/schema';

export function runDir(dataDir: string, id: RunId): string {
  return join(dataDir, 'runs', id);
}

export function resultPath(dataDir: string, id: RunId): string {
  return join(runDir(dataDir, id), 'result.json');
}

/**
 * `bench run` is idempotent on `(release, task, agent, attempt)`: a run whose `result.json`
 * already exists is skipped unless `--force` is passed, so a rerun resumes instead of duplicating.
 */
export function shouldSkipRun(dataDir: string, id: RunId, force: boolean): boolean {
  if (force) return false;
  return existsSync(resultPath(dataDir, id));
}
