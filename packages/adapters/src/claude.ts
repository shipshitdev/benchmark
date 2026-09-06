import { readVersion, spawnAndCapture } from './process';
import type { Adapter, AdapterRunInput, AdapterRunOutput, ParsedTranscript } from './types';

interface ClaudeContentBlock {
  type?: string;
}

interface ClaudeAssistantEvent {
  type: 'assistant';
  message?: { content?: ClaudeContentBlock[] };
}

interface ClaudeResultEvent {
  type: 'result';
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  result?: string;
}

function parseLine(line: string): unknown | undefined {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function isAssistantEvent(event: unknown): event is ClaudeAssistantEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type?: unknown }).type === 'assistant'
  );
}

function isResultEvent(event: unknown): event is ClaudeResultEvent {
  return (
    typeof event === 'object' && event !== null && (event as { type?: unknown }).type === 'result'
  );
}

/** Claude Code's `stream-json` transcript: assistant messages plus one final `result` event. */
export function parseClaudeTranscript(lines: string[]): ParsedTranscript {
  const events = lines.map(parseLine).filter((event) => event !== undefined);

  let toolCalls = 0;
  for (const event of events) {
    if (!isAssistantEvent(event)) continue;
    const content = event.message?.content ?? [];
    toolCalls += content.filter((block) => block.type === 'tool_use').length;
  }

  const resultEvent = [...events].reverse().find(isResultEvent);
  const notes: string[] = [];
  if (!resultEvent) notes.push('claude: no result event found in transcript');

  return {
    usage: {
      input: resultEvent?.usage?.input_tokens ?? null,
      output: resultEvent?.usage?.output_tokens ?? null,
      cacheRead: resultEvent?.usage?.cache_read_input_tokens ?? null,
      cacheWrite: resultEvent?.usage?.cache_creation_input_tokens ?? null,
      turns: resultEvent?.num_turns ?? null,
      toolCalls,
      durationMs: resultEvent?.duration_ms ?? 0,
      ...(resultEvent?.total_cost_usd !== undefined
        ? { reportedCostUsd: resultEvent.total_cost_usd }
        : {}),
    },
    finalText: resultEvent?.result ?? '',
    notes,
  };
}

function buildCommand(input: AdapterRunInput): { command: string[]; permissionMode: string } {
  const command = [
    'claude',
    '-p',
    input.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    input.model,
  ];
  if (input.effort) command.push('--effort', input.effort);
  command.push(
    '--max-turns',
    String(input.caps.maxTurns),
    '--max-budget-usd',
    String(input.caps.maxBudgetUsd),
  );

  let permissionMode: string;
  if (input.readOnly) {
    command.push('--permission-mode', 'plan', '--tools', 'Read,Glob,Grep');
    permissionMode = 'plan+tools:Read,Glob,Grep';
  } else {
    command.push('--dangerously-skip-permissions');
    permissionMode = 'dangerously-skip-permissions';
  }

  command.push(
    '--no-session-persistence',
    '--setting-sources',
    'project,local',
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
  );
  return { command, permissionMode };
}

export const claudeAdapter: Adapter = {
  cli: 'claude',
  version: () => readVersion('claude'),
  async run(input: AdapterRunInput): Promise<AdapterRunOutput> {
    const { command, permissionMode } = buildCommand(input);
    const env: Record<string, string> = { ...process.env, ...input.env } as Record<string, string>;
    if (input.env.CLAUDE_CONFIG_DIR) env.CLAUDE_CONFIG_DIR = input.env.CLAUDE_CONFIG_DIR;

    const captured = await spawnAndCapture(command, {
      cwd: input.cwd,
      env,
      transcriptPath: input.transcriptPath,
      timeboxMinutes: input.caps.timeboxMinutes,
    });
    const parsed = parseClaudeTranscript(captured.lines);
    const notes = [...parsed.notes];
    if (captured.status === 'timeout') notes.push('claude: killed after exceeding timebox');
    if (captured.status === 'error' && captured.stderrTail) {
      notes.push(`claude: stderr tail: ${captured.stderrTail}`);
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
