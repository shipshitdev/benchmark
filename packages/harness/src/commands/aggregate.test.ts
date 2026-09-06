import { describe, expect, test } from 'bun:test';
import { combineCategory, combineOverall } from './aggregate';

describe('combineCategory', () => {
  test('averages the cell score means for a category', () => {
    expect(combineCategory([80, 90, 100])).toBeCloseTo(90, 6);
  });

  test('is null with no tasks scored in the category', () => {
    expect(combineCategory([])).toBeNull();
  });
});

describe('combineOverall', () => {
  test('weights categories by their configured weight', () => {
    const overall = combineOverall(
      [
        { category: 'ux-ui', score: 80 },
        { category: 'backend', score: 60 },
      ],
      { 'ux-ui': 1, backend: 1 },
    );
    expect(overall).toBeCloseTo(70, 6);
  });

  test('skips a category with no tasks (score null)', () => {
    const overall = combineOverall(
      [
        { category: 'ux-ui', score: 80 },
        { category: 'signature', score: null },
      ],
      { 'ux-ui': 1, signature: 0 },
    );
    expect(overall).toBe(80);
  });

  test('is null when every category has a zero weight or a null score', () => {
    expect(combineOverall([{ category: 'ux-ui', score: null }], { 'ux-ui': 1 })).toBeNull();
    expect(combineOverall([{ category: 'ux-ui', score: 80 }], { 'ux-ui': 0 })).toBeNull();
  });
});
