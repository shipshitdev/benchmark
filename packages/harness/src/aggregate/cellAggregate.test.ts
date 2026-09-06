import { describe, expect, test } from 'bun:test';
import { parseAgentSpec, type RunResult, runId, TaskId } from '@benchmark/schema';
import { buildCell, combineScore } from './cellAggregate';

const task = TaskId.parse('ux-ui/pricing-page');
const agent = parseAgentSpec('claude:fable@high');

function makeRun(overrides: Partial<RunResult> & { attempt: number }): RunResult {
  return {
    id: runId('v1', task, agent, overrides.attempt),
    release: 'v1',
    suiteVersion: 'v2026.09',
    task,
    taskVersion: 1,
    agent: {
      cli: agent.cli,
      model: agent.model,
      ...(agent.effort ? { effort: agent.effort } : {}),
      version: '2.1.263',
      permissionMode: 'dangerously-skip-permissions',
      caps: { maxTurns: 40, maxBudgetUsd: 5, timeboxMinutes: 30 },
      command: ['claude'],
    },
    startedAt: '2026-09-06T00:00:00.000Z',
    finishedAt: '2026-09-06T00:01:00.000Z',
    host: 'test-host',
    status: 'ok',
    usage: {
      input: 1000,
      output: 200,
      cacheRead: 0,
      cacheWrite: 0,
      turns: 3,
      toolCalls: 2,
      durationMs: 60_000,
      costUsdEquivalent: 0.01,
    },
    gates: [{ id: 'build', pass: true, durationMs: 1000, detail: 'ok' }],
    objective: null,
    judgments: [],
    artifacts: {
      transcript: 'transcript.jsonl.gz',
      diff: 'diff.patch',
      screenshots: [],
      report: null,
    },
    notes: [],
    ...overrides,
  };
}

describe('combineScore', () => {
  test('weights objective and subjective together', () => {
    expect(combineScore(80, 60, { objective: 0.5, subjective: 0.5 })).toBe(70);
  });

  test('falls back to whichever layer is present', () => {
    expect(combineScore(80, null, { objective: 0.5, subjective: 0.5 })).toBe(80);
    expect(combineScore(null, 60, { objective: 0.5, subjective: 0.5 })).toBe(60);
  });

  test('is null when neither layer is present', () => {
    expect(combineScore(null, null, { objective: 0.5, subjective: 0.5 })).toBeNull();
  });
});

describe('buildCell', () => {
  const weights = { objective: 0.5, subjective: 0.5 };

  test('a gate-failed attempt contributes a hard 0 and is excluded from subjective', () => {
    const runs = [
      makeRun({ attempt: 1, objective: 90, judgments: [] }),
      makeRun({
        attempt: 2,
        status: 'gate_failed',
        objective: null,
        gates: [{ id: 'build', pass: false, durationMs: 500, detail: 'failed' }],
      }),
    ];
    const cell = buildCell(task, agent, runs, weights);
    expect(cell.gatePassRate).toBe(0.5);
    expect(cell.score?.min).toBe(0);
    expect(cell.score?.n).toBe(2);
    expect(cell.objective?.n).toBe(1);
  });

  test('an errored attempt is excluded from scores but still listed', () => {
    const cell = buildCell(
      task,
      agent,
      [
        makeRun({ attempt: 1, objective: 80, judgments: [] }),
        makeRun({ attempt: 2, status: 'error', objective: null, judgments: [] }),
      ],
      weights,
    );
    expect(cell.runs).toHaveLength(2);
    expect(cell.score?.n).toBe(1);
    expect(cell.objective?.mean).toBe(80);
  });

  test('an unjudged subjective-only run is unscored rather than zero', () => {
    const cell = buildCell(
      task,
      agent,
      [makeRun({ attempt: 1, objective: null, judgments: [] })],
      weights,
    );
    expect(cell.score).toBeNull();
  });

  test('a cell whose every attempt errored has no score', () => {
    const cell = buildCell(
      task,
      agent,
      [makeRun({ attempt: 1, status: 'error', objective: null, judgments: [] })],
      weights,
    );
    expect(cell.score).toBeNull();
  });

  test('score is null only when every attempt failed a gate', () => {
    const runs = [
      makeRun({
        attempt: 1,
        status: 'gate_failed',
        objective: null,
        gates: [{ id: 'build', pass: false, durationMs: 500, detail: 'failed' }],
      }),
    ];
    const cell = buildCell(task, agent, runs, weights);
    expect(cell.score).toBeNull();
    expect(cell.gatePassRate).toBe(0);
  });

  test('sums usage across attempts, null if any attempt is missing a field', () => {
    const runs = [
      makeRun({ attempt: 1, objective: 80 }),
      makeRun({
        attempt: 2,
        objective: 90,
        usage: { ...makeRun({ attempt: 2 }).usage, input: null },
      }),
    ];
    const cell = buildCell(task, agent, runs, weights);
    expect(cell.usage.input).toBeNull();
    expect(cell.usage.durationMs).toBe(120_000);
  });
});
