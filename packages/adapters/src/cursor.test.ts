import { describe, expect, test } from 'bun:test';
import { parseCursorTranscript } from './cursor';

async function loadLines(url: URL): Promise<string[]> {
  const text = await Bun.file(url).text();
  return text.split('\n').filter((line) => line.length > 0);
}

describe('parseCursorTranscript', () => {
  test('takes duration and final text from the result event', async () => {
    const lines = await loadLines(new URL('../fixtures/cursor-stream.jsonl', import.meta.url));
    const parsed = parseCursorTranscript(lines);
    expect(parsed.usage).toEqual({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
      turns: null,
      toolCalls: null,
      durationMs: 18450,
    });
    expect(parsed.finalText).toBe('Implemented the requested change across two files.');
    expect(parsed.notes).toEqual(['cursor: telemetry unavailable']);
  });

  test('falls back to the last assistant text when there is no result event', () => {
    const parsed = parseCursorTranscript([
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Working."}]}}',
    ]);
    expect(parsed.finalText).toBe('Working.');
    expect(parsed.usage.durationMs).toBe(0);
  });
});
