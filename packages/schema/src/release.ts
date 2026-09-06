import { z } from 'zod';
import { AgentSpec, Category, RunId, TaskId } from './ids';

const Score = z.number().min(0).max(100);

export const Spread = z.object({
  mean: Score,
  min: Score,
  max: Score,
  n: z.number().int().nonnegative(),
});
export type Spread = z.infer<typeof Spread>;

export const UsageTotals = z.object({
  input: z.number().int().nonnegative().nullable(),
  output: z.number().int().nonnegative().nullable(),
  cacheRead: z.number().int().nonnegative().nullable(),
  cacheWrite: z.number().int().nonnegative().nullable(),
  turns: z.number().nullable(),
  toolCalls: z.number().nullable(),
  durationMs: z.number().int().nonnegative(),
  costUsdEquivalent: z.number().nonnegative().nullable(),
});
export type UsageTotals = z.infer<typeof UsageTotals>;

/** One task × one agent, over all attempts. */
export const Cell = z.object({
  task: TaskId,
  agent: AgentSpec,
  runs: z.array(RunId),
  gatePassRate: z.number().min(0).max(1),
  objective: Spread.nullable(),
  subjective: Spread.nullable(),
  /** Combined per the task's weights; null when every run failed a gate. */
  score: Spread.nullable(),
  usage: UsageTotals,
});
export type Cell = z.infer<typeof Cell>;

export const CategoryScore = z.object({
  category: Category,
  agent: AgentSpec,
  score: Score.nullable(),
  tasks: z.number().int(),
});

export const PairwiseRating = z.object({
  agent: AgentSpec,
  /** Bradley-Terry strength on a log scale, centred at 0. */
  rating: z.number(),
  ciLow: z.number(),
  ciHigh: z.number(),
  comparisons: z.number().int().nonnegative(),
});

export const Standing = z.object({
  agent: AgentSpec,
  overall: Score.nullable(),
  categories: z.array(CategoryScore),
  usage: UsageTotals,
  /** overall / costUsdEquivalent; null when cost is unknown. */
  scorePerDollar: z.number().nullable(),
  telemetry: z.enum(['full', 'partial', 'none']),
});
export type Standing = z.infer<typeof Standing>;

/** `data/releases/<release>.json`, produced by `bench aggregate`. */
export const Release = z.object({
  release: z.string().min(1),
  title: z.string().min(1),
  suiteVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  pricesAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryWeights: z.record(Category, z.number().nonnegative()),
  agents: z.array(AgentSpec),
  tasks: z.array(
    z.object({ id: TaskId, category: Category, title: z.string(), version: z.number().int() }),
  ),
  cells: z.array(Cell),
  standings: z.array(Standing),
  pairwise: z.array(z.object({ task: TaskId, ratings: z.array(PairwiseRating) })),
  /** Which judges scored, for the methodology page. */
  judges: z.array(z.object({ cli: z.string(), model: z.string() })),
  notes: z.array(z.string()),
});
export type Release = z.infer<typeof Release>;
