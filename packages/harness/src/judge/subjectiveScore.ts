import type { RubricDimension } from '@benchmark/schema';

/**
 * Weighted mean of a judge's per-dimension 0..4 scores, scaled to 0..100:
 * `sum(score/4 * weight) / sum(weight) * 100`. A dimension the judge didn't score counts as 0.
 */
export function scoreSubjective(
  scores: Record<string, number>,
  dimensions: RubricDimension[],
): number {
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = dimensions.reduce(
    (sum, dimension) => sum + ((scores[dimension.id] ?? 0) / 4) * dimension.weight,
    0,
  );
  return (weightedSum / totalWeight) * 100;
}
