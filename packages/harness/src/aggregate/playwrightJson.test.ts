import { describe, expect, test } from 'bun:test';
import { parsePlaywrightJson } from './playwrightJson';

describe('parsePlaywrightJson', () => {
  test('computes pass rate excluding skipped tests', () => {
    const report = JSON.stringify({ stats: { expected: 8, unexpected: 1, flaky: 1, skipped: 2 } });
    expect(parsePlaywrightJson(report)).toEqual({
      expected: 8,
      unexpected: 1,
      flaky: 1,
      skipped: 2,
      passRate: 0.8,
    });
  });

  test('is 0 when nothing ran', () => {
    expect(parsePlaywrightJson(JSON.stringify({ stats: {} }))).toEqual({
      expected: 0,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
      passRate: 0,
    });
  });
});
