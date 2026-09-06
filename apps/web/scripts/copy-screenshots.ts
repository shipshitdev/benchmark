#!/usr/bin/env bun
/**
 * Prebuild step: flattens `data/runs/<run-id>/screenshots/*.png` into
 * `apps/web/public/runs/<run-id>/*.png` so the static export can reference them by URL
 * (`/runs/<run-id>/<file>.png`, see `screenshotUrl` in lib/data.ts). Never commit the copies —
 * `public/runs/` is gitignored and rebuilt on every `prebuild`.
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const dataDir = process.env.BENCH_DATA_DIR
  ? path.resolve(appRoot, process.env.BENCH_DATA_DIR)
  : path.resolve(appRoot, '../../data');

const runsDir = path.join(dataDir, 'runs');
const publicRunsDir = path.join(appRoot, 'public', 'runs');

rmSync(publicRunsDir, { recursive: true, force: true });

if (!existsSync(runsDir)) {
  console.log(`copy-screenshots: no ${runsDir}, nothing to copy`);
  process.exit(0);
}

const writes: Promise<number>[] = [];
for (const runId of readdirSync(runsDir, { withFileTypes: true })) {
  if (!runId.isDirectory()) continue;
  const screenshotsDir = path.join(runsDir, runId.name, 'screenshots');
  if (!existsSync(screenshotsDir)) continue;

  const destDir = path.join(publicRunsDir, runId.name);
  mkdirSync(destDir, { recursive: true });
  for (const file of readdirSync(screenshotsDir)) {
    if (!file.endsWith('.png')) continue;
    writes.push(Bun.write(path.join(destDir, file), Bun.file(path.join(screenshotsDir, file))));
  }
}
await Promise.all(writes);
console.log(`copy-screenshots: copied ${writes.length} screenshot(s) from ${runsDir}`);
