import type { Command } from 'commander';
import { loadConfig } from '../config';
import { log } from '../log';
import { renderTable } from '../table';
import { loadTasks } from '../tasks/loader';

interface ValidateOptions {
  dataDir?: string;
  tasksDir?: string;
}

export function registerValidate(program: Command): void {
  program
    .command('validate')
    .description('load every tasks/**/task.yaml and check it against the schema')
    .option('--data-dir <dir>', 'override the configured data directory')
    .option('--tasks-dir <dir>', 'override the configured tasks directory')
    .action(async (options: ValidateOptions) => {
      const { tasksDir } = await loadConfig(process.cwd(), {
        dataDir: options.dataDir,
        tasksDir: options.tasksDir,
      });
      const { tasks, errors } = await loadTasks(tasksDir);

      if (tasks.length > 0) {
        const rows = tasks
          .map((task) => [
            task.manifest.id,
            task.manifest.category,
            String(task.manifest.version),
            task.manifest.title,
          ])
          .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
        log.info(renderTable(['id', 'category', 'version', 'title'], rows));
      } else {
        log.info(`no tasks found under ${tasksDir}`);
      }

      if (errors.length > 0) {
        log.info('');
        log.error(`${errors.length} task(s) failed validation:`);
        for (const error of errors) log.error(`  ${error.taskPath}: ${error.message}`);
        process.exitCode = 1;
        return;
      }

      log.info('');
      log.info(`${tasks.length} task(s) valid.`);
    });
}
