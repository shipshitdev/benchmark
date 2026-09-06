import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readVersion, spawnAndCapture } from './process';

describe('spawnAndCapture', () => {
  test('streams stdout lines to the transcript file and reports ok status', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'spawn-capture-'));
    const transcriptPath = join(dir, 'transcript.jsonl');
    try {
      const result = await spawnAndCapture(['sh', '-c', 'printf "one\\ntwo\\n"'], {
        cwd: dir,
        env: process.env as Record<string, string>,
        transcriptPath,
        timeboxMinutes: 1,
      });
      expect(result.status).toBe('ok');
      expect(result.exitCode).toBe(0);
      expect(result.lines).toEqual(['one', 'two']);
      expect(await readFile(transcriptPath, 'utf8')).toBe('one\ntwo\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('reports a nonzero exit as error status', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'spawn-capture-'));
    const transcriptPath = join(dir, 'transcript.jsonl');
    try {
      const result = await spawnAndCapture(['sh', '-c', 'exit 3'], {
        cwd: dir,
        env: process.env as Record<string, string>,
        transcriptPath,
        timeboxMinutes: 1,
      });
      expect(result.status).toBe('error');
      expect(result.exitCode).toBe(3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('kills the process tree once the timebox elapses', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'spawn-capture-'));
    const transcriptPath = join(dir, 'transcript.jsonl');
    const markerFile = join(dir, 'child-finished');
    try {
      const startedAt = Date.now();
      const result = await spawnAndCapture(['sh', '-c', `(sleep 5; touch ${markerFile}) & wait`], {
        cwd: dir,
        env: process.env as Record<string, string>,
        transcriptPath,
        timeboxMinutes: 0.01,
      });
      expect(result.status).toBe('timeout');
      expect(Date.now() - startedAt).toBeLessThan(4000);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(await Bun.file(markerFile).exists()).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('readVersion', () => {
  test('returns trimmed stdout from a real binary', async () => {
    const version = await readVersion('bun');
    expect(version.length).toBeGreaterThan(0);
  });
});
