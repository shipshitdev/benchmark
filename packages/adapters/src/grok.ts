import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readVersion, spawnAndCapture } from './process';
import type {
  Adapter,
  AdapterRunInput,
  AdapterRunOutput,
  ParsedTranscript,
  ParsedUsage,
} from './types';

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AnthropicMessageEvent {
  type: 'message';
  role?: string;
  content?: AnthropicContentBlock[];
}

function parseLine(line: string): unknown | undefined {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function isMessageEvent(event: unknown): event is AnthropicMessageEvent {
  return (
    typeof event === 'object' && event !== null && (event as { type?: unknown }).type === 'message'
  );
}

/**
 * `streaming-messages-json` is documented only as "NDJSON in the Anthropic Messages API wire
 * format" (`grok --help`); this assumes complete assistant turns arrive as top-level
 * `{ type: 'message', role: 'assistant', content: [...] }` objects, matching that API's message
 * shape. Grok's own JSON carries no token usage (confirmed in DESIGN.md's CLI audit); usage is
 * always null here and only ever filled in from `grok trace`.
 */
export function parseGrokTranscript(lines: string[]): ParsedTranscript {
  const events = lines.map(parseLine).filter((event) => event !== undefined);

  let turns = 0;
  let toolCalls = 0;
  let finalText = '';
  for (const event of events) {
    if (!isMessageEvent(event) || event.role !== 'assistant') continue;
    turns += 1;
    const content = event.content ?? [];
    toolCalls += content.filter((block) => block.type === 'tool_use').length;
    const text = content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');
    if (text) finalText = text;
  }

  return {
    usage: {
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
      turns: turns > 0 ? turns : null,
      toolCalls,
      durationMs: 0,
    },
    finalText,
    notes: ['grok: token usage not present in CLI output'],
  };
}

const USAGE_KEY_PATTERN =
  /input_tokens|output_tokens|cache_read|cache_creation|prompt_tokens|completion_tokens/i;

/** Heuristic search of a `grok trace` export for anything usage-shaped; the export format is undocumented. */
export function findUsageShape(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUsageShape(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => USAGE_KEY_PATTERN.test(key))) return record;
  for (const nested of Object.values(record)) {
    const found = findUsageShape(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(path)));
    else if (/\.(json|jsonl)$/.test(entry.name)) files.push(path);
  }
  return files;
}

async function extractTraceUsage(
  sessionId: string,
  env: Record<string, string>,
): Promise<Partial<ParsedUsage> | null> {
  const workDir = await mkdtemp(join(tmpdir(), 'grok-trace-'));
  const archivePath = join(workDir, `${sessionId}.tar.gz`);
  try {
    const traceProc = Bun.spawn(
      ['grok', 'trace', sessionId, '--local', '--json', '-o', archivePath],
      {
        env,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    await traceProc.exited;
    if (!(await Bun.file(archivePath).exists())) return null;

    const untar = Bun.spawnSync(['tar', 'xzf', archivePath, '-C', workDir]);
    if (untar.exitCode !== 0) return null;

    for (const file of await walkFiles(workDir)) {
      if (file === archivePath) continue;
      const contents = await readFile(file, 'utf8');
      for (const line of file.endsWith('.jsonl') ? contents.split('\n') : [contents]) {
        if (!line.trim()) continue;
        const parsed = parseLine(line);
        if (parsed === undefined) continue;
        const usageShape = findUsageShape(parsed);
        if (!usageShape) continue;
        return {
          input: toNumber(usageShape.input_tokens ?? usageShape.prompt_tokens),
          output: toNumber(usageShape.output_tokens ?? usageShape.completion_tokens),
          cacheRead: toNumber(usageShape.cache_read_input_tokens ?? usageShape.cache_read),
          cacheWrite: toNumber(usageShape.cache_creation_input_tokens ?? usageShape.cache_creation),
        };
      }
    }
    return null;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function buildCommand(
  input: AdapterRunInput,
  sessionId: string,
): { command: string[]; permissionMode: string } {
  const command = [
    'grok',
    '-p',
    input.prompt,
    '--output-format',
    'streaming-messages-json',
    '-m',
    input.model,
    '--session-id',
    sessionId,
  ];
  if (input.effort) command.push('--reasoning-effort', input.effort);
  command.push('--max-turns', String(input.caps.maxTurns));

  let permissionMode: string;
  if (input.readOnly) {
    // `grok --help` has no literal "read-only" permission mode; "plan" is the closest built-in
    // (no edits, no shell), matching the spirit of the other three adapters' judge lane.
    command.push('--permission-mode', 'plan');
    permissionMode = 'plan';
  } else {
    command.push('--always-approve');
    permissionMode = 'always-approve';
  }
  command.push('--cwd', input.cwd);
  return { command, permissionMode };
}

export const grokAdapter: Adapter = {
  cli: 'grok',
  version: () => readVersion('grok'),
  async run(input: AdapterRunInput): Promise<AdapterRunOutput> {
    const sessionId = randomUUID();
    const { command, permissionMode } = buildCommand(input, sessionId);
    const env: Record<string, string> = { ...process.env, ...input.env } as Record<string, string>;
    if (input.env.GROK_HOME) env.GROK_HOME = input.env.GROK_HOME;

    const captured = await spawnAndCapture(command, {
      cwd: input.cwd,
      env,
      transcriptPath: input.transcriptPath,
      timeboxMinutes: input.caps.timeboxMinutes,
    });
    const parsed = parseGrokTranscript(captured.lines);
    const notes = [...parsed.notes];
    if (captured.status === 'timeout') notes.push('grok: killed after exceeding timebox');
    if (captured.status === 'error' && captured.stderrTail) {
      notes.push(`grok: stderr tail: ${captured.stderrTail}`);
    }

    let usage = parsed.usage;
    try {
      const traceUsage = await extractTraceUsage(sessionId, env);
      if (traceUsage) {
        usage = { ...usage, ...traceUsage };
      } else {
        notes.push('grok: telemetry unavailable');
      }
    } catch {
      notes.push('grok: telemetry unavailable');
    }

    return {
      usage: { ...usage, durationMs: captured.durationMs },
      exitCode: captured.exitCode,
      status: captured.status,
      command,
      permissionMode,
      notes,
      finalText: parsed.finalText,
    };
  },
};
