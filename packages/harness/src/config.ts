import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { Category } from '@benchmark/schema';
import { z } from 'zod';

export const BenchConfig = z.object({
  suiteVersion: z.string().min(1),
  categoryWeights: z.record(Category, z.number().nonnegative()),
  /** `cli:model[@effort]` specs, parsed with `parseAgentSpec` where a judge is actually invoked. */
  judges: z.array(z.string().min(1)),
  repeat: z.number().int().positive(),
  dataDir: z.string().min(1),
  tasksDir: z.string().min(1),
});
export type BenchConfig = z.infer<typeof BenchConfig>;

/** Resolved config plus the absolute directories it points at, so callers never re-derive paths. */
export interface ResolvedConfig {
  config: BenchConfig;
  repoRoot: string;
  dataDir: string;
  tasksDir: string;
}

/** Walks up from `startDir` looking for `bench.config.json`, so the CLI works from any package cwd. */
export function findConfigPath(startDir: string): string {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'bench.config.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`bench.config.json not found in ${startDir} or any parent directory`);
    }
    dir = parent;
  }
}

export interface ConfigOverrides {
  dataDir?: string;
  tasksDir?: string;
}

export async function loadConfig(
  startDir: string,
  overrides: ConfigOverrides = {},
): Promise<ResolvedConfig> {
  const configPath = findConfigPath(startDir);
  const repoRoot = dirname(configPath);
  const raw = JSON.parse(await Bun.file(configPath).text());
  const config = BenchConfig.parse(raw);

  const resolveDir = (fromConfig: string, override: string | undefined) => {
    const value = override ?? fromConfig;
    return isAbsolute(value) ? value : resolve(repoRoot, value);
  };

  return {
    config,
    repoRoot,
    dataDir: resolveDir(config.dataDir, overrides.dataDir),
    tasksDir: resolveDir(config.tasksDir, overrides.tasksDir),
  };
}
