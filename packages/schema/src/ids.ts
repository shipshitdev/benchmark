import { z } from 'zod';

export const CATEGORIES = [
  'ux-ui',
  'frontend',
  'backend',
  'planning-audit',
  'bugfix',
  'taste',
  'signature',
] as const;
export const Category = z.enum(CATEGORIES);
export type Category = z.infer<typeof Category>;

export const CLIS = ['claude', 'codex', 'grok', 'cursor'] as const;
export const Cli = z.enum(CLIS);
export type Cli = z.infer<typeof Cli>;

/** `<category>/<slug>`, e.g. `ux-ui/pricing-page`. */
export const TaskId = z
  .string()
  .regex(/^[a-z-]+\/[a-z0-9-]+$/, 'task id must be <category>/<slug>')
  .brand<'TaskId'>();
export type TaskId = z.infer<typeof TaskId>;

/** `<release>__<task slug>__<agent slug>__<attempt>`; stable, so reruns resume instead of duplicating. */
export const RunId = z
  .string()
  .regex(/^[a-z0-9.-]+__[a-z-]+--[a-z0-9-]+__[a-z0-9-]+--[a-z0-9.-]+(?:--[a-z]+)?__[1-9]$/)
  .brand<'RunId'>();
export type RunId = z.infer<typeof RunId>;

/**
 * Agent under test, parsed from `cli:model[@effort]`, e.g. `claude:fable@high`, `codex:gpt-6-astra@high`,
 * `grok:grok-4.6@high`, `cursor:auto`.
 */
export const AgentSpec = z.object({
  cli: Cli,
  model: z.string().min(1),
  effort: z.string().min(1).optional(),
});
export type AgentSpec = z.infer<typeof AgentSpec>;

export function parseAgentSpec(text: string): AgentSpec {
  const match = /^([a-z]+):([^@\s]+)(?:@([a-z]+))?$/.exec(text);
  if (!match) throw new Error(`agent spec must be cli:model[@effort], got "${text}"`);
  const [, cli, model, effort] = match;
  return AgentSpec.parse(effort ? { cli, model, effort } : { cli, model });
}

export function agentSlug(agent: AgentSpec): string {
  const model = agent.model.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
  return agent.effort ? `${agent.cli}--${model}--${agent.effort}` : `${agent.cli}--${model}`;
}

export function taskSlug(task: TaskId): string {
  return task.replace('/', '--');
}

export function runId(release: string, task: TaskId, agent: AgentSpec, attempt: number): RunId {
  return RunId.parse(`${release}__${taskSlug(task)}__${agentSlug(agent)}__${attempt}`);
}
