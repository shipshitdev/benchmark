import { describe, expect, test } from 'bun:test';
import { assignBlindLabels } from './blindLabels';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('assignBlindLabels', () => {
  test('labels items A, B, C in shuffled order', () => {
    const labeled = assignBlindLabels(['run-1', 'run-2', 'run-3'], seededRandom(1));
    expect(labeled.map((entry) => entry.label)).toEqual(['A', 'B', 'C']);
    expect(new Set(labeled.map((entry) => entry.item))).toEqual(
      new Set(['run-1', 'run-2', 'run-3']),
    );
  });

  test('is a permutation, never dropping or duplicating an item', () => {
    const items = Array.from({ length: 10 }, (_, i) => `run-${i}`);
    const labeled = assignBlindLabels(items, seededRandom(42));
    expect(labeled.map((entry) => entry.item).sort()).toEqual([...items].sort());
  });

  test('extends past Z with two-letter labels', () => {
    const items = Array.from({ length: 28 }, (_, i) => i);
    const labeled = assignBlindLabels(items, seededRandom(9));
    expect(labeled[25]?.label).toBe('Z');
    expect(labeled[26]?.label).toBe('AA');
    expect(labeled[27]?.label).toBe('AB');
  });
});
