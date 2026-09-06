import { describe, expect, test } from 'bun:test';
import { extractFirstJsonObject } from './jsonExtract';

describe('extractFirstJsonObject', () => {
  test('parses a clean JSON object', () => {
    expect(extractFirstJsonObject('{"A":{"scores":{"x":3}}}')).toEqual({
      A: { scores: { x: 3 } },
    });
  });

  test('pulls JSON out of a markdown-fenced response with surrounding prose', () => {
    const text = [
      'Here is my evaluation of the two entries:',
      '```json',
      '{"A": {"scores": {"aesthetics": 3}, "rationale": "clean layout"}}',
      '```',
      'Let me know if you need more detail.',
    ].join('\n');
    expect(extractFirstJsonObject(text)).toEqual({
      A: { scores: { aesthetics: 3 }, rationale: 'clean layout' },
    });
  });

  test('skips an unbalanced or invalid brace before finding the real object', () => {
    const text = 'note: use { like this } in code, then the answer: {"ok": true}';
    expect(extractFirstJsonObject(text)).toEqual({ ok: true });
  });

  test('ignores braces inside string literals when balancing', () => {
    const text = '{"rationale": "uses a { brace } inside a string", "score": 4}';
    expect(extractFirstJsonObject(text)).toEqual({
      rationale: 'uses a { brace } inside a string',
      score: 4,
    });
  });

  test('returns undefined when there is no JSON at all', () => {
    expect(extractFirstJsonObject('no json here')).toBeUndefined();
  });
});
