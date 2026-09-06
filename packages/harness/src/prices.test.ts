import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PriceTable } from '@benchmark/schema';
import { computeCost, loadPriceTable } from './prices';

const table: PriceTable = {
  asOf: '2026-09-06',
  currency: 'USD',
  unit: 'per 1M tokens',
  models: {
    'claude-fable-5-1': {
      vendorId: 'claude-fable-5-1',
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite: 3.75,
      source: 'https://example.com',
      note: '',
    },
  },
};

describe('loadPriceTable', () => {
  test('is null when data/prices.json does not exist', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'prices-'));
    try {
      expect(await loadPriceTable(dataDir)).toBeNull();
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  test('loads and validates an existing price table', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'prices-'));
    try {
      await writeFile(join(dataDir, 'prices.json'), JSON.stringify(table));
      expect(await loadPriceTable(dataDir)).toEqual(table);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});

describe('computeCost', () => {
  test('is null with a note when there is no price table', () => {
    const result = computeCost(
      'fable',
      { input: 100, output: 10, cacheRead: 0, cacheWrite: 0 },
      null,
    );
    expect(result.costUsdEquivalent).toBeNull();
    expect(result.note).toContain('prices.json not found');
  });

  test('is null with a note when the model has no price entry', () => {
    const result = computeCost(
      'unknown-model',
      { input: 100, output: 10, cacheRead: 0, cacheWrite: 0 },
      table,
    );
    expect(result.costUsdEquivalent).toBeNull();
    expect(result.note).toContain('no price table entry');
  });

  test('resolves the alias and computes cost at list price', () => {
    const result = computeCost(
      'fable',
      { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0 },
      table,
    );
    expect(result.priceKey).toBe('claude-fable-5-1');
    expect(result.costUsdEquivalent).toBe(4.5);
  });
});
