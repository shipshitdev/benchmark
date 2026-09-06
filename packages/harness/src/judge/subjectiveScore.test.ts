import { describe, expect, test } from 'bun:test';
import { scoreSubjective } from './subjectiveScore';

describe('scoreSubjective', () => {
  test('a perfect score on every dimension is 100 regardless of dimension count', () => {
    const dimensions = [
      { id: 'a', label: 'A', weight: 1 },
      { id: 'b', label: 'B', weight: 2 },
    ];
    expect(scoreSubjective({ a: 4, b: 4 }, dimensions)).toBe(100);
  });

  test('a zero score on every dimension is 0', () => {
    const dimensions = [{ id: 'a', label: 'A', weight: 1 }];
    expect(scoreSubjective({ a: 0 }, dimensions)).toBe(0);
  });

  test('weights the dimensions rather than averaging them equally', () => {
    const dimensions = [
      { id: 'a', label: 'A', weight: 3 },
      { id: 'b', label: 'B', weight: 1 },
    ];
    // a=4 (max) weight 3, b=0 (min) weight 1 => (3*1 + 1*0) / 4 * 100 = 75.
    expect(scoreSubjective({ a: 4, b: 0 }, dimensions)).toBe(75);
  });

  test('a missing dimension score counts as 0', () => {
    const dimensions = [
      { id: 'a', label: 'A', weight: 1 },
      { id: 'b', label: 'B', weight: 1 },
    ];
    expect(scoreSubjective({ a: 4 }, dimensions)).toBe(50);
  });

  test('is 0 when total weight is 0', () => {
    expect(scoreSubjective({ a: 4 }, [{ id: 'a', label: 'A', weight: 0 }])).toBe(0);
  });
});
