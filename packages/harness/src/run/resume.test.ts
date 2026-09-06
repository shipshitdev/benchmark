import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAgentSpec, runId, TaskId } from '@benchmark/schema';
import { resultPath, shouldSkipRun } from './resume';

describe('shouldSkipRun', () => {
  test('skips a run whose result.json already exists', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'resume-'));
    try {
      const id = runId(
        'v1',
        TaskId.parse('ux-ui/pricing-page'),
        parseAgentSpec('claude:fable@high'),
        1,
      );
      await mkdir(join(dataDir, 'runs', id), { recursive: true });
      await writeFile(resultPath(dataDir, id), '{}');

      expect(shouldSkipRun(dataDir, id, false)).toBe(true);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  test('does not skip a run with no existing result', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'resume-'));
    try {
      const id = runId(
        'v1',
        TaskId.parse('ux-ui/pricing-page'),
        parseAgentSpec('claude:fable@high'),
        2,
      );
      expect(shouldSkipRun(dataDir, id, false)).toBe(false);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  test('--force reruns even when a result already exists', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'resume-'));
    try {
      const id = runId(
        'v1',
        TaskId.parse('ux-ui/pricing-page'),
        parseAgentSpec('claude:fable@high'),
        3,
      );
      await mkdir(join(dataDir, 'runs', id), { recursive: true });
      await writeFile(resultPath(dataDir, id), '{}');

      expect(shouldSkipRun(dataDir, id, true)).toBe(false);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
