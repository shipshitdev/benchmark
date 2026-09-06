import type { LoadedTask } from './loader';

/** `all`, or a comma-separated list of task ids. */
export function selectTasks(tasks: LoadedTask[], selector: string): LoadedTask[] {
  if (selector === 'all') return tasks;
  const ids = new Set(
    selector
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
  return tasks.filter((task) => ids.has(task.manifest.id));
}
