import { readVersion, spawnAndCapture } from './process';
import type { Adapter, AdapterRunInput, AdapterRunOutput, ParsedTranscript } from './types';

interface CodexTurnCompletedEvent {
  type: 'turn.completed';
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number };
}

interface CodexItemCompletedEvent {
  type: 'item.completed';
  item?: { type?: string; text?: string };
}

/** `item.completed` item types that represent a tool invocation rather than model prose. */
const TOOL_ITEM_TYPES = new Set(['command_execution', 'file_change', 'tool_call', 'mcp_tool_call']);

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

/**
 * Codex's `--json` event stream: no single final-result event, so usage is summed across every
 * `turn.completed` and turns/tool calls are counted from `turn.completed`/`item.completed`.
 * Codex has no wall-clock or cost field in its own output; the caller fills `durationMs` in.
 */
export function parseCodexTranscript(lines: string[]): ParsedTranscript {
  const events = lines.map(parseLine).filter((event) => event !== undefined);

  let input = 0;
  let cacheRead = 0;
  let output = 0;
  let sawUsage = false;
  let turns = 0;
  let toolCalls = 0;
  let finalText = '';

  for (const event of events) {
    const type = eventType(event);
    if (type === 'turn.completed') {
      turns += 1;
      const usage = (event as CodexTurnCompletedEvent).usage;
      if (usage) {
        sawUsage = true;
        input += usage.input_tokens ?? 0;
        cacheRead += usage.cached_input_tokens ?? 0;
        output += usage.output_tokens ?? 0;
      }
    } else if (type === 'item.completed') {
      const item = (event as CodexItemCompletedEvent).item;
      if (item?.type && TOOL_ITEM_TYPES.has(item.type)) toolCalls += 1;
      if (item?.type === 'agent_message' && typeof item.text === 'string') finalText = item.text;
    }
  }

  const notes: string[] = [];
  if (turns === 0) notes.push('codex: no turn.completed events found in transcript');
  notes.push('codex: no turn cap flag; enforced only by the timebox');

  return {
    usage: {
      input: sawUsage ? input : null,
      output: sawUsage ? output : null,
      cacheRead: sawUsage ? cacheRead : null,
      cacheWrite: null,
      turns: turns > 0 ? turns : null,
      toolCalls,
      durationMs: 0,
    },
    finalText,
    notes,
  };
}

function buildCommand(
  input: AdapterRunInput,
  lastMessagePath: string,
): { command: string[]; permissionMode: string } {
  const command = ['codex', 'exec', '--json', '-m', input.model];
  if (input.effort) command.push('-c', `model_reasoning_effort=${input.effort}`);

  let permissionMode: string;
  if (input.readOnly) {
    command.push('-s', 'read-only');
    permissionMode = 'read-only';
  } else {
    command.push('-s', 'workspace-write', '--dangerously-bypass-approvals-and-sandbox');
    permissionMode = 'workspace-write+bypass-approvals-and-sandbox';
  }

  command.push('-C', input.cwd, '--skip-git-repo-check', '-o', lastMessagePath, input.prompt);
  return { command, permissionMode };
}

export const codexAdapter: Adapter = {
  cli: 'codex',
  version: () => readVersion('codex'),
  async run(input: AdapterRunInput): Promise<AdapterRunOutput> {
    const lastMessagePath = `${input.cwd}/../codex-last-message.md`;
    const { command, permissionMode } = buildCommand(input, lastMessagePath);
    const env: Record<string, string> = { ...process.env, ...input.env } as Record<string, string>;

    const captured = await spawnAndCapture(command, {
      cwd: input.cwd,
      env,
      transcriptPath: input.transcriptPath,
      timeboxMinutes: input.caps.timeboxMinutes,
    });
    const parsed = parseCodexTranscript(captured.lines);
    const notes = [...parsed.notes];
    if (captured.status === 'timeout') notes.push('codex: killed after exceeding timebox');
    if (captured.status === 'error' && captured.stderrTail) {
      notes.push(`codex: stderr tail: ${captured.stderrTail}`);
    }

    let finalText = parsed.finalText;
    if (!finalText) {
      const lastMessageFile = Bun.file(lastMessagePath);
      if (await lastMessageFile.exists()) finalText = await lastMessageFile.text();
    }

    return {
      usage: { ...parsed.usage, durationMs: captured.durationMs },
      exitCode: captured.exitCode,
      status: captured.status,
      command,
      permissionMode,
      notes,
      finalText,
    };
  },
};
