/** Process spawning shared by every adapter: stream stdout to a transcript file, enforce a timebox. */

export interface SpawnCaptureOptions {
  cwd: string;
  env: Record<string, string>;
  /** Absolute path to write raw stdout lines to, one per line, truncated first. */
  transcriptPath: string;
  timeboxMinutes: number;
}

export interface SpawnCaptureResult {
  exitCode: number | null;
  status: 'ok' | 'timeout' | 'error';
  /** Non-empty stdout lines, in order, for a parser to consume. */
  lines: string[];
  /** Tail of stderr, for diagnostics when a run errors. */
  stderrTail: string;
  durationMs: number;
}

/**
 * Kills a spawned CLI and its direct children. Bun.spawn does not expose process-group creation
 * (no `detached` option as of 1.3.14), so this reaps one level of children via `pkill -P` before
 * killing the CLI itself; a tool the CLI shells out to that itself forks further is not reached.
 */
function killTree(pid: number): void {
  try {
    Bun.spawnSync(['pkill', '-TERM', '-P', String(pid)]);
  } catch {
    // pkill unavailable or no matching children; fall through to killing the pid directly
  }
  try {
    Bun.spawnSync(['pkill', '-KILL', '-P', String(pid)]);
  } catch {
    // as above
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // already exited
  }
}

export async function spawnAndCapture(
  command: string[],
  options: SpawnCaptureOptions,
): Promise<SpawnCaptureResult> {
  const { cwd, env, transcriptPath, timeboxMinutes } = options;
  const startedAt = Date.now();
  await Bun.write(transcriptPath, '');

  const [bin, ...args] = command;
  if (!bin) throw new Error('spawnAndCapture: empty command');
  const proc = Bun.spawn([bin, ...args], { cwd, env, stdout: 'pipe', stderr: 'pipe' });

  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    killTree(proc.pid);
  }, timeboxMinutes * 60_000);

  const transcriptWriter = Bun.file(transcriptPath).writer();
  const lines: string[] = [];
  let buffer = '';

  const drainStdout = async () => {
    const decoder = new TextDecoder();
    const reader = proc.stdout.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      transcriptWriter.write(text);
      buffer += text;
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        if (line.length > 0) lines.push(line);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    }
    if (buffer.length > 0) lines.push(buffer);
  };

  const drainStderr = async () => {
    const decoder = new TextDecoder();
    const reader = proc.stderr.getReader();
    const chunks: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }
    return chunks.join('').slice(-4000);
  };

  const [, stderrTail] = await Promise.all([drainStdout(), drainStderr()]);
  await transcriptWriter.end();
  const exitCode = await proc.exited;
  clearTimeout(timeoutHandle);

  const status: SpawnCaptureResult['status'] = timedOut
    ? 'timeout'
    : exitCode === 0
      ? 'ok'
      : 'error';
  return { exitCode, status, lines, stderrTail, durationMs: Date.now() - startedAt };
}

/** Runs `<cli> --version` and returns the trimmed output verbatim, stdout preferred over stderr. */
export async function readVersion(bin: string): Promise<string> {
  const proc = Bun.spawn([bin, '--version'], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  const text = stdout.trim().length > 0 ? stdout : stderr;
  return text.trim();
}
