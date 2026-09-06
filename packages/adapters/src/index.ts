import type { Cli } from '@benchmark/schema';
import { claudeAdapter } from './claude';
import { codexAdapter } from './codex';
import { cursorAdapter } from './cursor';
import { grokAdapter } from './grok';
import type { Adapter } from './types';

export { claudeAdapter, parseClaudeTranscript } from './claude';
export { codexAdapter, parseCodexTranscript } from './codex';
export { cursorAdapter, parseCursorTranscript } from './cursor';
export { findUsageShape, grokAdapter, parseGrokTranscript } from './grok';
export * from './types';

const ADAPTERS: Record<Cli, Adapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  grok: grokAdapter,
  cursor: cursorAdapter,
};

export function adapterFor(cli: Cli): Adapter {
  return ADAPTERS[cli];
}
