import { CLIS } from '@benchmark/schema';
import type { Command } from 'commander';
import { loadConfig } from '../config';
import { log } from '../log';
import { renderTable } from '../table';
import { loadTasks } from '../tasks/loader';

interface ListOptions {
  dataDir?: string;
  tasksDir?: string;
}

export function registerList(program: Command): void {
  program
    .command('list')
    .description('list the task suite and the CLIs an agent spec can name')
    .option('--data-dir <dir>', 'override the configured data directory')
    .option('--tasks-dir <dir>', 'override the configured tasks directory')
    .action(async (options: ListOptions) => {
      const { config, tasksDir } = await loadConfig(process.cwd(), {
        dataDir: options.dataDir,
        tasksDir: options.tasksDir,
      });
      const { tasks, errors } = await loadTasks(tasksDir);

      log.info('Tasks:');
      if (tasks.length > 0) {
        const rows = tasks
          .map((task) => [task.manifest.id, task.manifest.category, task.manifest.title])
          .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
        log.info(renderTable(['id', 'category', 'title'], rows));
      } else {
        log.info(`  (none found under ${tasksDir})`);
      }
      if (errors.length > 0) {
        log.warn(`  ${errors.length} task(s) fail validation; run "bench validate" for detail.`);
      }

      log.info('');
      log.info('Supported CLIs (agent spec: cli:model[@effort]):');
      log.info(`  ${CLIS.join(', ')}`);

      log.info('');
      log.info('Configured judges:');
      log.info(config.judges.length > 0 ? `  ${config.judges.join(', ')}` : '  (none configured)');
    });
}
