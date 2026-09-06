import { describe, expect, test } from 'bun:test';
import { parseChecklist, scoreChecklist } from './checklist';

describe('parseChecklist', () => {
  test('reads a YAML list of items', () => {
    const yaml = ['- id: missing-null-check', '  description: crashes on empty input'].join('\n');
    expect(parseChecklist(yaml)).toEqual([
      { id: 'missing-null-check', description: 'crashes on empty input' },
    ]);
  });

  test('rejects a non-list document', () => {
    expect(() => parseChecklist('id: not-a-list')).toThrow();
  });
});

describe('scoreChecklist', () => {
  const items = [
    { id: 'a', description: 'issue a' },
    { id: 'b', description: 'issue b' },
    { id: 'c', description: 'issue c' },
    { id: 'd', description: 'issue d' },
  ];

  test('full recall with no hallucinations scores 100', () => {
    expect(scoreChecklist(items, ['a', 'b', 'c', 'd'], 0, 5)).toBe(100);
  });

  test('partial recall applies a hallucination penalty', () => {
    // 3 of 4 found = 75 recall, minus one unsupported finding at penalty 5 => 70.
    expect(scoreChecklist(items, ['a', 'b', 'c'], 1, 5)).toBe(70);
  });

  test('drops a found id that is not on the checklist rather than crediting it', () => {
    expect(scoreChecklist(items, ['a', 'not-a-real-id'], 0, 5)).toBe(25);
  });

  test('floors at 0 instead of going negative', () => {
    expect(scoreChecklist(items, [], 100, 5)).toBe(0);
  });

  test('is 0 for an empty checklist', () => {
    expect(scoreChecklist([], ['a'], 0, 5)).toBe(0);
  });
});
