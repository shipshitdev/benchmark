import { describe, expect, test } from 'bun:test';
import { buildJudgePrompt } from './promptBuilder';

describe('buildJudgePrompt', () => {
  const base = {
    taskTitle: 'Pricing page',
    rubricMarkdown: '0: broken. 4: excellent.',
    dimensions: [{ id: 'aesthetics', label: 'Aesthetics', weight: 1 }],
    entries: [
      { label: 'A', item: { screenshots: ['a-desktop.png'], diffPath: 'a.diff' } },
      { label: 'B', item: { diffPath: 'b.diff' } },
    ],
  };

  test('includes the rubric, dimensions, entry labels, and evidence paths', () => {
    const prompt = buildJudgePrompt({ ...base, pairwise: false });
    expect(prompt).toContain('Pricing page');
    expect(prompt).toContain('0: broken. 4: excellent.');
    expect(prompt).toContain('aesthetics');
    expect(prompt).toContain('### Entry A');
    expect(prompt).toContain('a-desktop.png');
    expect(prompt).toContain('### Entry B');
    expect(prompt).not.toContain('pairs');
  });

  test('adds pairwise instructions only when requested', () => {
    const prompt = buildJudgePrompt({ ...base, pairwise: true });
    expect(prompt).toContain('"pairs"');
    expect(prompt).toContain('winner');
  });
});
