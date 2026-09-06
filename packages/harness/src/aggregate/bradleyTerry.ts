export interface PairwiseComparison {
  a: string;
  b: string;
  winner: 'a' | 'b' | 'tie';
}

export interface BradleyTerryRating {
  item: string;
  /** Log-scale strength, centred at 0 (mean log-strength across items is always 0). */
  rating: number;
  ciLow: number;
  ciHigh: number;
  comparisons: number;
}

/**
 * MM algorithm for the Bradley-Terry model (Hunter 2004): iteratively updates each item's
 * strength from its win total and the harmonic-style sum over opponents, renormalizing to a
 * geometric mean of 1 every iteration so strengths neither drift to 0 nor diverge.
 */
function fitStrengths(
  items: string[],
  comparisons: PairwiseComparison[],
  iterations: number,
): number[] {
  const n = items.length;
  const index = new Map(items.map((item, i) => [item, i]));
  const wins: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (const comparison of comparisons) {
    const i = index.get(comparison.a);
    const j = index.get(comparison.b);
    if (i === undefined || j === undefined) continue;
    const rowI = wins[i] as number[];
    const rowJ = wins[j] as number[];
    if (comparison.winner === 'a') rowI[j] = (rowI[j] ?? 0) + 1;
    else if (comparison.winner === 'b') rowJ[i] = (rowJ[i] ?? 0) + 1;
    else {
      rowI[j] = (rowI[j] ?? 0) + 0.5;
      rowJ[i] = (rowJ[i] ?? 0) + 0.5;
    }
  }

  const totalWins = wins.map((row) => row.reduce((sum, value) => sum + value, 0));
  const games: number[][] = wins.map((row, i) =>
    row.map((value, j) => value + (wins[j]?.[i] ?? 0)),
  );

  let strengths = new Array(n).fill(1);
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let denominator = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const nij = games[i]?.[j] ?? 0;
        if (nij === 0) continue;
        denominator += nij / ((strengths[i] as number) + (strengths[j] as number));
      }
      const updated =
        denominator > 0 ? (totalWins[i] as number) / denominator : (strengths[i] as number);
      next[i] = updated > 0 ? updated : (strengths[i] as number) * 0.5 || 1e-9;
    }
    const meanLog = next.reduce((sum: number, value: number) => sum + Math.log(value), 0) / n;
    const scale = Math.exp(meanLog);
    strengths = next.map((value: number) => value / scale);
  }
  return strengths;
}

/**
 * Bradley-Terry ratings with a 95% bootstrap confidence interval, resampling the comparison list
 * with replacement. `items` with no comparisons at all still get a rating of 0 (no evidence
 * either way) and a zero-width interval.
 */
export function bradleyTerry(
  items: string[],
  comparisons: PairwiseComparison[],
  options: { bootstrapResamples?: number; iterations?: number; random?: () => number } = {},
): BradleyTerryRating[] {
  const { bootstrapResamples = 200, iterations = 200, random = Math.random } = options;

  const comparisonCounts = new Map(items.map((item) => [item, 0]));
  for (const comparison of comparisons) {
    comparisonCounts.set(comparison.a, (comparisonCounts.get(comparison.a) ?? 0) + 1);
    comparisonCounts.set(comparison.b, (comparisonCounts.get(comparison.b) ?? 0) + 1);
  }

  // An item with zero comparisons carries no evidence; fitting it jointly with the rest would
  // let the shared normalization step drift its "rating" based on everyone else's convergence.
  // Give it a flat, zero-width neutral rating instead of running it through the model.
  const activeItems = items.filter((item) => (comparisonCounts.get(item) ?? 0) > 0);

  const pointStrengths = fitStrengths(activeItems, comparisons, iterations);
  const pointRatings = new Map(
    activeItems.map((item, i) => [item, Math.log(pointStrengths[i] as number)]),
  );

  const samples = new Map<string, number[]>(activeItems.map((item) => [item, []]));
  for (let resample = 0; resample < bootstrapResamples && comparisons.length > 0; resample++) {
    const resampled: PairwiseComparison[] = [];
    for (let draw = 0; draw < comparisons.length; draw++) {
      const index = Math.floor(random() * comparisons.length);
      resampled.push(comparisons[index] as PairwiseComparison);
    }
    const strengths = fitStrengths(activeItems, resampled, iterations);
    activeItems.forEach((item, i) => {
      samples.get(item)?.push(Math.log(strengths[i] as number));
    });
  }

  const percentileOf = (values: number[], p: number, fallback: number): number => {
    if (values.length === 0) return fallback;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return sorted[index] as number;
  };

  return items.map((item) => {
    if (!pointRatings.has(item)) {
      return { item, rating: 0, ciLow: 0, ciHigh: 0, comparisons: 0 };
    }
    const rating = pointRatings.get(item) ?? 0;
    const values = samples.get(item) ?? [];
    return {
      item,
      rating,
      ciLow: percentileOf(values, 0.025, rating),
      ciHigh: percentileOf(values, 0.975, rating),
      comparisons: comparisonCounts.get(item) ?? 0,
    };
  });
}
