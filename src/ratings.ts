const DEFAULT_RATING = 1500;
const K_FACTOR = 32;

export function createRating(value = DEFAULT_RATING): number {
  return value;
}

/** Expected score for team A against team B (Elo formula). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Update ratings after a game; returns [newRatingA, newRatingB]. */
export function updateRatings(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  scoreB: number,
  k = K_FACTOR
): [number, number] {
  const total = scoreA + scoreB;
  if (total === 0) {
    return [ratingA, ratingB];
  }

  const actualA = scoreA / total;
  const actualB = scoreB / total;
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;

  return [
    Math.round(ratingA + k * (actualA - expectedA)),
    Math.round(ratingB + k * (actualB - expectedB)),
  ];
}
