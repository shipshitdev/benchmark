import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RunResult } from '@benchmark/schema';
import { resultPath } from './resume';

/** Every `result.json` under `data/runs/`, optionally filtered to one release. */
export async function listRunResults(dataDir: string, release?: string): Promise<RunResult[]> {
  const runsRoot = join(dataDir, 'runs');
  let entries: string[];
  try {
    entries = await readdir(runsRoot);
  } catch {
    return [];
  }

  const results: RunResult[] = [];
  for (const entry of entries) {
    const file = Bun.file(join(runsRoot, entry, 'result.json'));
    if (!(await file.exists())) continue;
    const parsed = RunResult.parse(JSON.parse(await file.text()));
    if (!release || parsed.release === release) results.push(parsed);
  }
  return results;
}

export async function writeRunResult(dataDir: string, result: RunResult): Promise<void> {
  const validated = RunResult.parse(result);
  await Bun.write(resultPath(dataDir, validated.id), JSON.stringify(validated, null, 2));
}
