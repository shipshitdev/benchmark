import { z } from 'zod';
import { AgentSpec, Cli, RunId, TaskId } from './ids';
import { Caps } from './task';

/** Token counts as reported by the CLI. `null` means the CLI does not expose the number. */
export const Usage = z.object({
  input: z.number().int().nonnegative().nullable(),
  output: z.number().int().nonnegative().nullable(),
  cacheRead: z.number().int().nonnegative().nullable(),
  cacheWrite: z.number().int().nonnegative().nullable(),
  turns: z.number().int().nonnegative().nullable(),
  toolCalls: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative(),
  /** Derived by the harness from `data/prices.json`; null when tokens are unavailable. */
  costUsdEquivalent: z.number().nonnegative().nullable(),
  /** The CLI's own figure when it prints one (Claude Code does), kept as a cross-check. */
  reportedCostUsd: z.number().nonnegative().optional(),
  /** Which price table entry produced `costUsdEquivalent`. */
  priceKey: z.string().min(1).optional(),
});
export type Usage = z.infer<typeof Usage>;

export const GateResult = z.object({
  id: z.string().min(1),
  pass: z.boolean(),
  mode: z.enum(['block', 'penalty']).default('block'),
  /** Points subtracted from the run's combined score when a penalty gate fails. */
  penalty: z.number().min(0).max(100).default(0),
  durationMs: z.number().int().nonnegative(),
  /** Tail of stdout/stderr or a one-line reason; full logs live in `gates/<id>.log`. */
  detail: z.string(),
});
export type GateResult = z.infer<typeof GateResult>;

export const RunStatus = z.enum(['ok', 'gate_failed', 'timeout', 'error']);
export type RunStatus = z.infer<typeof RunStatus>;

export const AgentRecord = AgentSpec.extend({
  /** CLI version string as printed by `<cli> --version`. */
  version: z.string().min(1),
  permissionMode: z.string().min(1),
  caps: Caps,
  /** Exact argv used, so a reader can reproduce the run. */
  command: z.array(z.string()),
});
export type AgentRecord = z.infer<typeof AgentRecord>;

export const JudgeScores = z.record(z.string(), z.number().int().min(0).max(4));

export const Judgment = z.object({
  judge: z.object({ cli: Cli, model: z.string().min(1), version: z.string().min(1) }),
  /** Label the judge saw; the mapping back to agents is resolved only after scoring. */
  blindLabel: z.string().min(1),
  scores: JudgeScores,
  /** Weighted 0..100 from `scores` and the task's dimension weights. */
  subjective: z.number().min(0).max(100),
  rationale: z.string(),
  usage: Usage,
});
export type Judgment = z.infer<typeof Judgment>;

/** One judge's pick between two runs of the same task. */
export const PairwiseVerdict = z.object({
  task: TaskId,
  judge: z.object({ cli: Cli, model: z.string().min(1) }),
  a: RunId,
  b: RunId,
  winner: z.enum(['a', 'b', 'tie']),
  rationale: z.string(),
});
export type PairwiseVerdict = z.infer<typeof PairwiseVerdict>;

/** `data/runs/<run-id>/result.json`. Everything the site shows traces back to one of these. */
export const RunResult = z.object({
  id: RunId,
  release: z.string().min(1),
  suiteVersion: z.string().min(1),
  task: TaskId,
  taskVersion: z.number().int().positive(),
  agent: AgentRecord,
  attempt: z.number().int().min(1),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  host: z.string().min(1),
  status: RunStatus,
  usage: Usage,
  gates: z.array(GateResult),
  /** 0..100 or null when the task has no objective layer or the run failed a gate. */
  objective: z.number().min(0).max(100).nullable(),
  judgments: z.array(Judgment),
  artifacts: z.object({
    /** All paths relative to the run directory. */
    transcript: z.string().min(1),
    diff: z.string().min(1).nullable(),
    screenshots: z.array(z.object({ path: z.string(), viewport: z.string(), file: z.string() })),
    report: z.string().min(1).nullable(),
  }),
  /** Non-fatal notes: missing telemetry, cap hit, judge unavailable. */
  notes: z.array(z.string()),
});
export type RunResult = z.infer<typeof RunResult>;
