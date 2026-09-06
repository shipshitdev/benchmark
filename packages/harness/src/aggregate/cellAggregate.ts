import type { AgentSpec, Cell, RunResult, TaskId, UsageTotals } from '@benchmark/schema';
import { computeSpread } from './spread';

export interface CellWeights {
  objective: number;
  subjective: number;
}

function meanOrNull(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sumOrNull(values: (number | null)[]): number | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce((sum: number, value) => sum + (value as number), 0);
}

/** Weighted mean of whichever of objective/subjective are present; null when neither is. */
export function combineScore(
  objective: number | null,
  subjective: number | null,
  weights: CellWeights,
): number | null {
  const parts: Array<{ value: number; weight: number }> = [];
  if (objective !== null) parts.push({ value: objective, weight: weights.objective });
  if (subjective !== null) parts.push({ value: subjective, weight: weights.subjective });
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (parts.length === 0 || totalWeight === 0) return null;
  return parts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight;
}

export function buildUsageTotals(runs: RunResult[]): UsageTotals {
  return {
    input: sumOrNull(runs.map((run) => run.usage.input)),
    output: sumOrNull(runs.map((run) => run.usage.output)),
    cacheRead: sumOrNull(runs.map((run) => run.usage.cacheRead)),
    cacheWrite: sumOrNull(runs.map((run) => run.usage.cacheWrite)),
    turns: sumOrNull(runs.map((run) => run.usage.turns)),
    toolCalls: sumOrNull(runs.map((run) => run.usage.toolCalls)),
    durationMs: runs.reduce((sum, run) => sum + run.usage.durationMs, 0),
    costUsdEquivalent: sumOrNull(runs.map((run) => run.usage.costUsdEquivalent)),
  };
}

function runSubjective(run: RunResult): number | null {
  return run.judgments.length > 0
    ? meanOrNull(run.judgments.map((judgment) => judgment.subjective))
    : null;
}

/**
 * One task x one agent, over every attempt. A gate-failed run contributes a hard 0 to the score
 * spread and is excluded from the subjective spread (DESIGN.md section 4); `score` itself is null
 * only when every attempt failed a gate, per the `Cell` schema's comment on that field.
 */
export function buildCell(
  task: TaskId,
  agent: AgentSpec,
  runs: RunResult[],
  weights: CellWeights,
): Cell {
  const gatesPassed = (run: RunResult) =>
    run.gates.length === 0 || run.gates.every((gate) => gate.pass);
  const gatePassRate = runs.length > 0 ? runs.filter(gatesPassed).length / runs.length : 0;

  const objectiveScores = runs
    .map((run) => run.objective)
    .filter((value): value is number => value !== null);

  const subjectiveScores = runs
    .filter((run) => run.status !== 'gate_failed')
    .map(runSubjective)
    .filter((value): value is number => value !== null);

  const allGateFailed = runs.length > 0 && runs.every((run) => run.status === 'gate_failed');
  const combinedScores = runs.map((run) => {
    if (run.status === 'gate_failed') return 0;
    return combineScore(run.objective, runSubjective(run), weights) ?? 0;
  });

  return {
    task,
    agent,
    runs: runs.map((run) => run.id),
    gatePassRate,
    objective: computeSpread(objectiveScores),
    subjective: computeSpread(subjectiveScores),
    score: allGateFailed ? null : computeSpread(combinedScores),
    usage: buildUsageTotals(runs),
  };
}
