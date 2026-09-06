import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

async function runGit(args: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${stderr.trim()}`);
  }
}

/**
 * Copies a task's fixture (or creates an empty directory when the task has none) into a fresh
 * run workspace, strips any `.git` the fixture carried, then re-inits so the agent's own commit
 * makes its diff exactly its work (`git diff` against this initial commit).
 */
export async function createWorkspace(
  fixtureDir: string | undefined,
  workspaceDir: string,
): Promise<void> {
  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(workspaceDir, { recursive: true });

  if (fixtureDir && existsSync(fixtureDir)) {
    await cp(fixtureDir, workspaceDir, { recursive: true });
    await rm(join(workspaceDir, '.git'), { recursive: true, force: true });
  }

  await runGit(['init', '--initial-branch=main'], workspaceDir);
  await runGit(['config', 'user.email', 'bench@shipshit.dev'], workspaceDir);
  await runGit(['config', 'user.name', 'shipshit.dev bench'], workspaceDir);
  await runGit(['add', '-A'], workspaceDir);
  // `--allow-empty`: a task with no fixture still needs a root commit to diff the agent's work against.
  await runGit(
    ['commit', '--allow-empty', '-m', 'fixture: initial state', '--no-gpg-sign'],
    workspaceDir,
  );
}

/** `git diff` against the initial commit, plus any files the agent left untracked. */
export async function captureDiff(workspaceDir: string): Promise<string> {
  await runGit(['add', '-A'], workspaceDir);
  const proc = Bun.spawn(['git', 'diff', '--cached', 'HEAD'], {
    cwd: workspaceDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const diff = await new Response(proc.stdout).text();
  await proc.exited;
  return diff;
}
