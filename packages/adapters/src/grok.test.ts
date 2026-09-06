import { describe, expect, test } from 'bun:test';
import { findUsageShape, parseGrokTranscript } from './grok';

async function loadLines(url: URL): Promise<string[]> {
  const text = await Bun.file(url).text();
  return text.split('\n').filter((line) => line.length > 0);
}

describe('parseGrokTranscript', () => {
  test('counts assistant message turns and tool_use blocks, with no token usage', async () => {
    const lines = await loadLines(new URL('../fixtures/grok-messages.jsonl', import.meta.url));
    const parsed = parseGrokTranscript(lines);
    expect(parsed.usage).toEqual({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
      turns: 2,
      toolCalls: 1,
      durationMs: 0,
    });
    expect(parsed.finalText).toBe('Found the bug in the parser.');
    expect(parsed.notes).toEqual(['grok: token usage not present in CLI output']);
  });

  test('ignores non-message events such as deltas', () => {
    const parsed = parseGrokTranscript(['{"type":"message_start"}']);
    expect(parsed.usage.turns).toBeNull();
  });
});

describe('findUsageShape', () => {
  test('finds a nested object carrying usage-shaped keys', async () => {
    const text = await Bun.file(
      new URL('../fixtures/grok-trace-export.jsonl', import.meta.url),
    ).text();
    const parsed = JSON.parse(text.trim());
    const usage = findUsageShape(parsed);
    expect(usage).toEqual({
      input_tokens: 950,
      output_tokens: 210,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 0,
    });
  });

  test('returns null when nothing looks like usage', () => {
    expect(findUsageShape({ foo: 'bar', nested: { baz: 1 } })).toBeNull();
  });
});
