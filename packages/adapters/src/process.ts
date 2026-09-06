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

/** Deepest-first list of every live descendant of `pid`, via `pgrep -P` (present on macOS and Linux). */
function descendants(pid: number): number[] {
  const result = Bun.spawnSync(['pgrep', '-P', String(pid)]);
  const children = result.stdout
    .toString()
    .split(/\s+/)
    .map(Number)
    .filter((child) => Number.isInteger(child) && child > 0);
  return children.flatMap((child) => [...descendants(child), child]);
}

/**
 * Bun.spawn cannot create a process group (no `detached` option as of 1.3.14), so the whole tree is
 * walked and killed explicitly. Descendants first, so a shell cannot respawn a child on SIGCHLD.
 */
function killTree(pid: number): void {
  for (const target of [...descendants(pid), pid]) {
    try {
      process.kill(target, 'SIGKILL');
    } catch {
      // already exited
    }
  }
}

interface ByteReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
}

async function drainLines(reader: ByteReader, onText: (text: string) => void): Promise<void> {
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      onText(decoder.decode(value, { stream: true }));
    }
  } catch {
    // reader cancelled by the timebox; whatever arrived is already consumed
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
  const stdoutReader = proc.stdout.getReader();
  const stderrReader = proc.stderr.getReader();

  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    killTree(proc.pid);
    // An orphaned grandchild could still hold the pipes open; stop waiting on them.
    void stdoutReader.cancel();
    void stderrReader.cancel();
  }, timeboxMinutes * 60_000);

  const transcriptWriter = Bun.file(transcriptPath).writer();
  const lines: string[] = [];
  let buffer = '';
  const stderrChunks: string[] = [];

  await Promise.all([
    drainLines(stdoutReader, (text) => {
      transcriptWriter.write(text);
      buffer += text;
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        if (line.length > 0) lines.push(line);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    }),
    drainLines(stderrReader, (text) => {
      stderrChunks.push(text);
    }),
  ]);
  if (buffer.length > 0) lines.push(buffer);
  await transcriptWriter.end();
  const exitCode = await proc.exited;
  clearTimeout(timeoutHandle);

  const status: SpawnCaptureResult['status'] = timedOut
    ? 'timeout'
    : exitCode === 0
      ? 'ok'
      : 'error';
  return {
    exitCode,
    status,
    lines,
    stderrTail: stderrChunks.join('').slice(-4000),
    durationMs: Date.now() - startedAt,
  };
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
