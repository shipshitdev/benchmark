import { describe, expect, test } from 'bun:test';
import { bradleyTerry, type PairwiseComparison } from './bradleyTerry';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('bradleyTerry', () => {
  test('two-player case matches the closed-form win-ratio MLE', () => {
    const comparisons: PairwiseComparison[] = [
      { a: 'A', b: 'B', winner: 'a' },
      { a: 'A', b: 'B', winner: 'a' },
      { a: 'A', b: 'B', winner: 'a' },
      { a: 'A', b: 'B', winner: 'b' },
    ];
    const ratings = bradleyTerry(['A', 'B'], comparisons, { random: seededRandom(1) });
    const a = ratings.find((r) => r.item === 'A');
    const b = ratings.find((r) => r.item === 'B');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // For exactly two items the Bradley-Terry MLE strength ratio equals the empirical win ratio.
    expect(Math.exp((a?.rating ?? 0) - (b?.rating ?? 0))).toBeCloseTo(3, 3);
    expect(a?.comparisons).toBe(4);
    expect(b?.comparisons).toBe(4);
  });

  test('ranks a transitive tournament A > B > C in the expected order', () => {
    const comparisons: PairwiseComparison[] = [
      { a: 'A', b: 'B', winner: 'a' },
      { a: 'A', b: 'B', winner: 'a' },
      { a: 'B', b: 'C', winner: 'a' },
      { a: 'B', b: 'C', winner: 'a' },
      { a: 'A', b: 'C', winner: 'a' },
      { a: 'A', b: 'C', winner: 'a' },
    ];
    const ratings = bradleyTerry(['A', 'B', 'C'], comparisons, {
      bootstrapResamples: 20,
      random: seededRandom(7),
    });
    const byItem = new Map(ratings.map((r) => [r.item, r.rating]));
    expect(byItem.get('A') ?? 0).toBeGreaterThan(byItem.get('B') ?? 0);
    expect(byItem.get('B') ?? 0).toBeGreaterThan(byItem.get('C') ?? 0);
  });

  test('a tie contributes half a win to each side', () => {
    const ratings = bradleyTerry(['A', 'B'], [{ a: 'A', b: 'B', winner: 'tie' }], {
      random: seededRandom(2),
    });
    const a = ratings.find((r) => r.item === 'A');
    const b = ratings.find((r) => r.item === 'B');
    expect(a?.rating ?? 0).toBeCloseTo(b?.rating ?? 0, 6);
  });

  test('an item with no comparisons gets a neutral rating and a zero-width interval', () => {
    const ratings = bradleyTerry(['A', 'B', 'Unplayed'], [{ a: 'A', b: 'B', winner: 'a' }], {
      random: seededRandom(3),
    });
    const unplayed = ratings.find((r) => r.item === 'Unplayed');
    expect(unplayed?.comparisons).toBe(0);
    expect(unplayed?.rating).toBe(0);
    expect(unplayed?.ciLow).toBe(unplayed?.rating);
    expect(unplayed?.ciHigh).toBe(unplayed?.rating);
  });
});
