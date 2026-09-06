import { describe, expect, test } from 'bun:test';
import { parseCodexTranscript } from './codex';

async function loadLines(url: URL): Promise<string[]> {
  const text = await Bun.file(url).text();
  return text.split('\n').filter((line) => line.length > 0);
}

describe('parseCodexTranscript', () => {
  test('sums usage across turn.completed events and counts tool item.completed events', async () => {
    const lines = await loadLines(new URL('../fixtures/codex-events.jsonl', import.meta.url));
    const parsed = parseCodexTranscript(lines);
    expect(parsed.usage).toEqual({
      input: 1100,
      output: 240,
      cacheRead: 200,
      cacheWrite: null,
      turns: 2,
      toolCalls: 2,
      durationMs: 0,
    });
    expect(parsed.finalText).toBe('Ran the tests and fixed the failing case.');
    expect(parsed.notes).toEqual(['codex: no turn cap flag; enforced only by the timebox']);
  });

  test('notes a transcript with no turns and leaves usage null', () => {
    const parsed = parseCodexTranscript([]);
    expect(parsed.usage.turns).toBeNull();
    expect(parsed.usage.input).toBeNull();
    expect(parsed.notes).toContain('codex: no turn.completed events found in transcript');
  });
});
