import { describe, expect, test } from 'bun:test';
import { agentSlug, parseAgentSpec, runId, TaskId } from './ids';
import { costUsdEquivalent } from './prices';
import { TaskManifest } from './task';

describe('agent specs', () => {
  test('parses cli:model@effort', () => {
    expect(parseAgentSpec('claude:fable@high')).toEqual({
      cli: 'claude',
      model: 'fable',
      effort: 'high',
    });
    expect(parseAgentSpec('cursor:auto')).toEqual({ cli: 'cursor', model: 'auto' });
  });
  test('rejects unknown cli', () => {
    expect(() => parseAgentSpec('gemini:pro')).toThrow();
  });
  test('run ids are stable and parse back', () => {
    const task = TaskId.parse('ux-ui/pricing-page');
    const id = runId('v2026.09-fable', task, parseAgentSpec('grok:grok-4.6@high'), 2);
    expect(String(id)).toBe('v2026.09-fable__ux-ui--pricing-page__grok--grok-4.6--high__2');
    expect(agentSlug(parseAgentSpec('codex:gpt-6-astra'))).toBe('codex--gpt-6-astra');
  });
});

describe('cost', () => {
  const price = {
    vendorId: 'x',
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
    source: 'https://example.com',
    note: '',
  };
  test('sums token classes at list price', () => {
    expect(
      costUsdEquivalent({ input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0 }, price),
    ).toBe(4.5);
  });
  test('is null when tokens are unknown', () => {
    expect(
      costUsdEquivalent({ input: null, output: null, cacheRead: null, cacheWrite: null }, price),
    ).toBeNull();
  });
});

describe('task manifest', () => {
  const base = {
    id: 'ux-ui/pricing-page',
    category: 'ux-ui',
    title: 'Pricing page',
    summary: 'Build a pricing page',
    version: 1,
    authored: '2026-09-06',
    caps: { maxTurns: 40, maxBudgetUsd: 5, timeboxMinutes: 30 },
    scoring: {
      subjective: {
        rubric: 'rubric.md',
        dimensions: [{ id: 'aesthetics', label: 'Aesthetics', weight: 1 }],
        evidence: ['screenshots'],
      },
    },
  };
  test('accepts a minimal manifest and fills defaults', () => {
    const task = TaskManifest.parse(base);
    expect(task.prompt).toBe('prompt.md');
    expect(task.scoring.weights).toEqual({ objective: 0.5, subjective: 0.5 });
  });
  test('rejects id/category mismatch', () => {
    expect(() => TaskManifest.parse({ ...base, category: 'frontend' })).toThrow();
  });
  test('rejects report evidence without a report path', () => {
    const bad = {
      ...base,
      scoring: { subjective: { ...base.scoring.subjective, evidence: ['report'] } },
    };
    expect(() => TaskManifest.parse(bad)).toThrow();
  });
});
