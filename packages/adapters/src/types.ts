import type { Caps, Cli } from '@benchmark/schema';

/**
 * Token/turn/tool counts an adapter can recover from a transcript, before the harness attaches
 * pricing. `costUsdEquivalent` and `priceKey` are computed later from `data/prices.json`, so they
 * are not part of what an adapter reports.
 */
export interface ParsedUsage {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  turns: number | null;
  toolCalls: number | null;
  durationMs: number;
  reportedCostUsd?: number;
}

/** What a pure `parse<Cli>Transcript` function recovers from a captured transcript. */
export interface ParsedTranscript {
  usage: ParsedUsage;
  finalText: string;
  notes: string[];
}

export interface AdapterRunInput {
  prompt: string;
  cwd: string;
  model: string;
  effort?: string;
  caps: Caps;
  /** Absolute path the adapter streams raw stdout events to, one per line. */
  transcriptPath: string;
  env: Record<string, string>;
  /** Judge lanes run read-only: no file writes, no shell, no skip-permissions. */
  readOnly?: boolean;
}

export interface AdapterRunOutput {
  usage: ParsedUsage;
  exitCode: number | null;
  status: 'ok' | 'timeout' | 'error';
  /** Exact argv used, so a reader can reproduce the run. */
  command: string[];
  permissionMode: string;
  notes: string[];
  finalText: string;
}

export interface Adapter {
  cli: Cli;
  version(): Promise<string>;
  run(input: AdapterRunInput): Promise<AdapterRunOutput>;
}
