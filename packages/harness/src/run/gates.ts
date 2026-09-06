import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Gate, GateResult } from '@benchmark/schema';
import { parsePlaywrightJson } from '../aggregate/playwrightJson';
import { startServe } from './serve';

const LOG_TAIL_CHARS = 2000;

export async function runWithTimeout(
  command: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutSeconds: number,
): Promise<{ exitCode: number | null; output: string }> {
  const proc = Bun.spawn(command, { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const timeoutHandle = setTimeout(() => {
    try {
      proc.kill('SIGKILL');
    } catch {
      // already exited
    }
  }, timeoutSeconds * 1000);
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  clearTimeout(timeoutHandle);
  return { exitCode, output: `${stdout}\n${stderr}` };
}

async function writeLog(logPath: string, content: string): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  await Bun.write(logPath, content);
}

function tail(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > LOG_TAIL_CHARS ? trimmed.slice(-LOG_TAIL_CHARS) : trimmed;
}

async function copySpecIntoWorkspace(
  taskDir: string,
  workspaceDir: string,
  gateId: string,
  spec: string,
): Promise<string> {
  const destination = join(workspaceDir, '__bench_specs__', `${gateId}${extname(spec)}`);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(taskDir, spec), destination);
  return destination;
}

function extname(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot);
}

async function runCommandGate(
  gate: Extract<Gate, { type: 'command' }>,
  workspaceDir: string,
  logPath: string,
): Promise<GateResult> {
  const startedAt = Date.now();
  const { exitCode, output } = await runWithTimeout(
    ['sh', '-c', gate.run],
    workspaceDir,
    process.env as Record<string, string>,
    gate.timeoutSeconds,
  );
  await writeLog(logPath, output);
  return {
    id: gate.id,
    pass: exitCode === 0,
    durationMs: Date.now() - startedAt,
    detail: tail(output) || (exitCode === 0 ? 'ok' : `exit ${exitCode}`),
  };
}

async function runPlaywrightGate(
  gate: Extract<Gate, { type: 'playwright' }>,
  taskDir: string,
  workspaceDir: string,
  logPath: string,
): Promise<GateResult> {
  const startedAt = Date.now();
  const specPath = await copySpecIntoWorkspace(taskDir, workspaceDir, gate.id, gate.spec);
  const serveHandle = await startServe(gate.serve, workspaceDir);
  try {
    const env = { ...process.env, BASE_URL: serveHandle.baseUrl } as Record<string, string>;
    const { exitCode, output } = await runWithTimeout(
      ['bunx', 'playwright', 'test', specPath, '--reporter=json'],
      workspaceDir,
      env,
      gate.timeoutSeconds,
    );
    await writeLog(logPath, output);
    let detail = exitCode === 0 ? 'ok' : `exit ${exitCode}`;
    try {
      const summary = parsePlaywrightJson(output);
      detail = `${Math.round(summary.passRate * 100)}% pass (expected ${summary.expected}, unexpected ${summary.unexpected}, flaky ${summary.flaky})`;
    } catch {
      detail = tail(output) || detail;
    }
    return { id: gate.id, pass: exitCode === 0, durationMs: Date.now() - startedAt, detail };
  } finally {
    await serveHandle.stop();
  }
}

async function runHttpContractGate(
  gate: Extract<Gate, { type: 'http-contract' }>,
  taskDir: string,
  workspaceDir: string,
  logPath: string,
): Promise<GateResult> {
  const startedAt = Date.now();
  const specPath = await copySpecIntoWorkspace(taskDir, workspaceDir, gate.id, gate.spec);
  const serveHandle = await startServe(gate.serve, workspaceDir);
  try {
    const env = { ...process.env, BASE_URL: serveHandle.baseUrl } as Record<string, string>;
    const { exitCode, output } = await runWithTimeout(
      ['bun', 'test', specPath],
      workspaceDir,
      env,
      gate.timeoutSeconds,
    );
    await writeLog(logPath, output);
    return {
      id: gate.id,
      pass: exitCode === 0,
      durationMs: Date.now() - startedAt,
      detail: tail(output) || (exitCode === 0 ? 'ok' : `exit ${exitCode}`),
    };
  } finally {
    await serveHandle.stop();
  }
}

const IMPACT_RANK = { minor: 0, moderate: 1, serious: 2, critical: 3 } as const;

async function runAxeGate(
  gate: Extract<Gate, { type: 'axe' }>,
  workspaceDir: string,
  logPath: string,
): Promise<GateResult> {
  const startedAt = Date.now();
  const serveHandle = await startServe(gate.serve, workspaceDir);
  const threshold = IMPACT_RANK[gate.failOn];
  try {
    const { chromium } = await import('@playwright/test');
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    const browser = await chromium.launch();
    const violations: Array<{ path: string; id: string; impact: string | null | undefined }> = [];
    try {
      for (const path of gate.paths) {
        const page = await browser.newPage();
        await page.goto(new URL(path, serveHandle.baseUrl).toString());
        const results = await new AxeBuilder({ page }).analyze();
        for (const violation of results.violations) {
          const rank = violation.impact
            ? IMPACT_RANK[violation.impact as keyof typeof IMPACT_RANK]
            : 0;
          if (rank >= threshold)
            violations.push({ path, id: violation.id, impact: violation.impact });
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
    await writeLog(logPath, JSON.stringify(violations, null, 2));
    return {
      id: gate.id,
      pass: violations.length === 0,
      durationMs: Date.now() - startedAt,
      detail:
        violations.length === 0
          ? `no violations at or above ${gate.failOn}`
          : `${violations.length} violation(s) at or above ${gate.failOn}`,
    };
  } finally {
    await serveHandle.stop();
  }
}

/** Runs a task's gates in order inside the workspace; the first failure stops the sequence. */
export async function runGates(
  gates: Gate[],
  taskDir: string,
  workspaceDir: string,
  gatesLogDir: string,
): Promise<GateResult[]> {
  const results: GateResult[] = [];
  for (const gate of gates) {
    const logPath = join(gatesLogDir, `${gate.id}.log`);
    let result: GateResult;
    switch (gate.type) {
      case 'command':
        result = await runCommandGate(gate, workspaceDir, logPath);
        break;
      case 'playwright':
        result = await runPlaywrightGate(gate, taskDir, workspaceDir, logPath);
        break;
      case 'axe':
        result = await runAxeGate(gate, workspaceDir, logPath);
        break;
      case 'http-contract':
        result = await runHttpContractGate(gate, taskDir, workspaceDir, logPath);
        break;
    }
    results.push(result);
    if (!result.pass) break;
  }
  return results;
}
