import { readVersion, spawnAndCapture } from './process';
import type { Adapter, AdapterRunInput, AdapterRunOutput, ParsedTranscript } from './types';

interface CursorContentBlock {
  type?: string;
  text?: string;
}

interface CursorAssistantEvent {
  type: 'assistant';
  message?: { content?: CursorContentBlock[] };
}

interface CursorResultEvent {
  type: 'result';
  duration_ms?: number;
  result?: string;
}

function parseLine(line: string): unknown | undefined {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function eventType(event: unknown): string | undefined {
  return typeof event === 'object' && event !== null
    ? ((event as { type?: unknown }).type as string | undefined)
    : undefined;
}

/** `cursor-agent --output-format stream-json` reports no token usage or turn count; only timing. */
export function parseCursorTranscript(lines: string[]): ParsedTranscript {
  const events = lines.map(parseLine).filter((event) => event !== undefined);

  let lastAssistantText = '';
  for (const event of events) {
    if (eventType(event) !== 'assistant') continue;
    const content = (event as CursorAssistantEvent).message?.content ?? [];
    const text = content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');
    if (text) lastAssistantText = text;
  }

  const resultEvent = [...events].reverse().find((event) => eventType(event) === 'result') as
    | CursorResultEvent
    | undefined;

  return {
    usage: {
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
      turns: null,
      toolCalls: null,
      durationMs: resultEvent?.duration_ms ?? 0,
    },
    finalText: resultEvent?.result ?? lastAssistantText,
    notes: ['cursor: telemetry unavailable'],
  };
}

function buildCommand(input: AdapterRunInput): { command: string[]; permissionMode: string } {
  const command = [
    'cursor-agent',
    '--print',
    '--output-format',
    'stream-json',
    '--model',
    input.model,
  ];

  let permissionMode: string;
  if (input.readOnly) {
    command.push('--mode', 'plan');
    permissionMode = 'plan';
  } else {
    command.push('--force');
    permissionMode = 'force';
  }

  command.push('--workspace', input.cwd, input.prompt);
  return { command, permissionMode };
}

export const cursorAdapter: Adapter = {
  cli: 'cursor',
  version: () => readVersion('cursor-agent'),
  async run(input: AdapterRunInput): Promise<AdapterRunOutput> {
    const { command, permissionMode } = buildCommand(input);
    const env: Record<string, string> = { ...process.env, ...input.env } as Record<string, string>;

    const captured = await spawnAndCapture(command, {
      cwd: input.cwd,
      env,
      transcriptPath: input.transcriptPath,
      timeboxMinutes: input.caps.timeboxMinutes,
    });
    const parsed = parseCursorTranscript(captured.lines);
    const notes = [...parsed.notes];
    if (captured.status === 'timeout') notes.push('cursor: killed after exceeding timebox');
    if (captured.status === 'error' && captured.stderrTail) {
      notes.push(`cursor: stderr tail: ${captured.stderrTail}`);
    }

    return {
      usage: {
        ...parsed.usage,
        durationMs: parsed.usage.durationMs > 0 ? parsed.usage.durationMs : captured.durationMs,
      },
      exitCode: captured.exitCode,
      status: captured.status,
      command,
      permissionMode,
      notes,
      finalText: parsed.finalText,
    };
  },
};
