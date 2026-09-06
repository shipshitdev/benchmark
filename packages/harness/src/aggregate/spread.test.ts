import { describe, expect, test } from 'bun:test';
import { computeSpread } from './spread';

describe('computeSpread', () => {
  test('computes mean/min/max/n over three runs', () => {
    expect(computeSpread([80, 90, 100])).toEqual({ mean: 90, min: 80, max: 100, n: 3 });
  });

  test('is null with no scores', () => {
    expect(computeSpread([])).toBeNull();
  });

  test('handles a single run', () => {
    expect(computeSpread([42])).toEqual({ mean: 42, min: 42, max: 42, n: 1 });
  });
});
