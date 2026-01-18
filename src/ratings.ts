const DEFAULT_RATING = 1500;
const K_FACTOR = 32;

export interface TeamRating {
  rating: number;
  gamesPlayed: number;
}

export function createRating(value = DEFAULT_RATING): number {
  return value;
}

export function createTeamRating(rating = DEFAULT_RATING): TeamRating {
  return { rating, gamesPlayed: 0 };
}

/** Provisional teams get a higher K; established teams move more slowly. */
export function kFactorForTeam(gamesPlayed: number, baseK = K_FACTOR): number {
  if (gamesPlayed < 10) {
    return Math.round(baseK * 1.25);
  }
  if (gamesPlayed < 30) {
    return baseK;
  }
  return Math.round(baseK * 0.8);
}

/** Expected score for team A against team B (Elo formula). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Probability the lower-rated team upsets the favorite. */
export function upsetProbability(
  favoriteRating: number,
  underdogRating: number
): number {
  return expectedScore(underdogRating, favoriteRating);
}

/**
 * True when the lower-rated team won.
 * Ties and equal ratings are never upsets.
 */
export function isRatingUpset(
  ratingA: number,
  ratingB: number,
  winnerIsA: boolean,
  isTie = false
): boolean {
  if (isTie || ratingA === ratingB) {
    return false;
  }
  return ratingA > ratingB ? !winnerIsA : winnerIsA;
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

/** Update tracked team ratings using per-team K factors. */
export function updateTeamRatings(
  teamA: TeamRating,
  teamB: TeamRating,
  scoreA: number,
  scoreB: number
): [TeamRating, TeamRating] {
  const k = (kFactorForTeam(teamA.gamesPlayed) + kFactorForTeam(teamB.gamesPlayed)) / 2;
  const [newRatingA, newRatingB] = updateRatings(
    teamA.rating,
    teamB.rating,
    scoreA,
    scoreB,
    k
  );

  return [
    { rating: newRatingA, gamesPlayed: teamA.gamesPlayed + 1 },
    { rating: newRatingB, gamesPlayed: teamB.gamesPlayed + 1 },
  ];
}
