import type { Spread } from '@benchmark/schema';

/** Mean/min/max/n over a set of 0..100 scores; null when there is nothing to average. */
export function computeSpread(scores: number[]): Spread | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((total, score) => total + score, 0);
  return {
    mean: sum / scores.length,
    min: Math.min(...scores),
    max: Math.max(...scores),
    n: scores.length,
  };
}
