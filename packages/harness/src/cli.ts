#!/usr/bin/env bun
import { Command } from 'commander';
import { registerAggregate } from './commands/aggregate';
import { registerJudge } from './commands/judge';
import { registerList } from './commands/list';
import { registerRun } from './commands/run';
import { registerValidate } from './commands/validate';
import { log } from './log';

const program = new Command();
program.name('bench').description('shipshit.dev model benchmark harness').version('0.0.1');

registerValidate(program);
registerList(program);
registerRun(program);
registerJudge(program);
registerAggregate(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
