import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type Gate, type ObjectiveScoring, TaskManifest } from '@benchmark/schema';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export interface LoadedTask {
  /** Absolute directory containing this task's `task.yaml`. */
  dir: string;
  manifest: TaskManifest;
}

export interface TaskLoadError {
  taskPath: string;
  message: string;
}

export interface TaskLoadResult {
  tasks: LoadedTask[];
  errors: TaskLoadError[];
}

async function findTaskManifests(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const manifests: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) manifests.push(...(await findTaskManifests(path)));
    else if (entry.name === 'task.yaml') manifests.push(path);
  }
  return manifests;
}

function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
  }
  return error instanceof Error ? error.message : String(error);
}

function missingFile(taskDir: string, relativePath: string, label: string): string | undefined {
  return existsSync(join(taskDir, relativePath))
    ? undefined
    : `${label} not found: ${relativePath}`;
}

function checkGate(taskDir: string, gate: Gate): string[] {
  switch (gate.type) {
    case 'playwright':
    case 'http-contract': {
      const message = missingFile(taskDir, gate.spec, `gate "${gate.id}" spec`);
      return message ? [message] : [];
    }
    case 'command':
    case 'axe':
      return [];
  }
}

function checkObjective(taskDir: string, objective: ObjectiveScoring): string[] {
  switch (objective.type) {
    case 'playwright-pass-rate':
    case 'http-contract-pass-rate': {
      const message = missingFile(taskDir, objective.spec, 'objective spec');
      return message ? [message] : [];
    }
    case 'hidden-tests':
      return objective.files
        .map((file) => missingFile(taskDir, file, 'hidden-tests file'))
        .filter((message): message is string => message !== undefined);
    case 'checklist': {
      const message = missingFile(taskDir, objective.checklist, 'checklist file');
      return message ? [message] : [];
      // `report` is written by the agent into the run directory; it does not exist yet.
    }
  }
}

function checkReferencedFiles(taskDir: string, manifest: TaskManifest): string[] {
  const errors: string[] = [];
  const promptError = missingFile(taskDir, manifest.prompt, 'prompt');
  if (promptError) errors.push(promptError);

  if (manifest.fixture) {
    const fixtureError = missingFile(taskDir, manifest.fixture, 'fixture');
    if (fixtureError) errors.push(fixtureError);
  }

  for (const gate of manifest.gates) errors.push(...checkGate(taskDir, gate));

  if (manifest.scoring.objective) {
    errors.push(...checkObjective(taskDir, manifest.scoring.objective));
  }

  const subjective = manifest.scoring.subjective;
  if (subjective) {
    const rubricError = missingFile(taskDir, subjective.rubric, 'rubric');
    if (rubricError) errors.push(rubricError);
  }

  return errors;
}

/** Loads and validates every `task.yaml` under `tasksDir` against `TaskManifest`. */
export async function loadTasks(tasksDir: string): Promise<TaskLoadResult> {
  const tasks: LoadedTask[] = [];
  const errors: TaskLoadError[] = [];
  if (!existsSync(tasksDir)) return { tasks, errors };

  for (const manifestPath of await findTaskManifests(tasksDir)) {
    const dir = dirname(manifestPath);
    try {
      const raw = parseYaml(await Bun.file(manifestPath).text());
      const manifest = TaskManifest.parse(raw);
      const fileErrors = checkReferencedFiles(dir, manifest);
      if (fileErrors.length > 0) {
        for (const message of fileErrors) errors.push({ taskPath: manifestPath, message });
      } else {
        tasks.push({ dir, manifest });
      }
    } catch (error) {
      errors.push({ taskPath: manifestPath, message: describeError(error) });
    }
  }
  return { tasks, errors };
}
