import { describe, expect, test } from 'bun:test';
import { parseClaudeTranscript } from './claude';

async function loadLines(url: URL): Promise<string[]> {
  const text = await Bun.file(url).text();
  return text.split('\n').filter((line) => line.length > 0);
}

describe('parseClaudeTranscript', () => {
  test('reads usage and final text off the terminal result event', async () => {
    const lines = await loadLines(new URL('../fixtures/claude-stream.jsonl', import.meta.url));
    const parsed = parseClaudeTranscript(lines);
    expect(parsed.usage).toEqual({
      input: 1200,
      output: 340,
      cacheRead: 8000,
      cacheWrite: 500,
      turns: 4,
      toolCalls: 2,
      durationMs: 52341,
      reportedCostUsd: 0.0842,
    });
    expect(parsed.finalText).toBe('Added the pricing page component.');
    expect(parsed.notes).toEqual([]);
  });

  test('flags a transcript with no result event', () => {
    const parsed = parseClaudeTranscript(['{"type":"assistant","message":{"content":[]}}']);
    expect(parsed.notes).toEqual(['claude: no result event found in transcript']);
    expect(parsed.usage.input).toBeNull();
  });

  test('skips unparsable lines instead of throwing', () => {
    const parsed = parseClaudeTranscript(['not json', '{"type":"result","result":"ok"}']);
    expect(parsed.finalText).toBe('ok');
  });
});
