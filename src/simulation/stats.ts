export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function marginStdDev(margins: number[], avgMargin: number): number {
  if (margins.length <= 1) {
    return 0;
  }

  const variance =
    margins.reduce((sum, margin) => sum + (margin - avgMargin) ** 2, 0) /
    margins.length;
  return Math.sqrt(variance);
}

export function summarizeMargins(margins: number[], avgMargin: number) {
  const sorted = [...margins].sort((a, b) => a - b);
  return {
    marginStdDev: marginStdDev(margins, avgMargin),
    marginPercentiles: {
      p10: percentile(sorted, 10),
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
    },
  };
}

/** Wilson score interval for a binomial proportion (default 95% z = 1.96). */
export function wilsonScoreInterval(
  successes: number,
  trials: number,
  z = 1.96
): { low: number; high: number } {
  if (trials <= 0) {
    return { low: 0, high: 0 };
  }

  const clampedSuccesses = Math.max(0, Math.min(successes, trials));
  const p = clampedSuccesses / trials;

  if (z <= 0) {
    return { low: p, high: p };
  }
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const margin =
    (z / denominator) *
    Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));

  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}
