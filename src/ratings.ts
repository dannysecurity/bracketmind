import {
  defaultRatingModel,
  type RatingModel,
} from "./ratingsModel.js";
import {
  applyRatingUpdate,
  createTeamRating,
  type TeamRating,
} from "./models/teamRating.js";

export type { TeamRating } from "./models/teamRating.js";
export { createTeamRating } from "./models/teamRating.js";

const DEFAULT_RATING = 1500;
/** Base K used for standard and contextual Elo updates. */
export const DEFAULT_K_FACTOR = defaultRatingModel().baseKFactor;
const RATING_GAP_DIVISOR = 40;
/** Baseline expected margin for evenly matched teams (1500 vs 1500). */
export const EVEN_MATCHUP_EXPECTED_MARGIN = 5;

/** Expected point margin when the winner beats the loser, scaled by rating gap. */
export function expectedMarginFromRatings(
  winnerRating: number,
  loserRating: number
): number {
  const gap = winnerRating - loserRating;
  const isUpset = gap < 0;
  const gapFactor = Math.abs(gap) / RATING_GAP_DIVISOR;
  const base = EVEN_MATCHUP_EXPECTED_MARGIN + gapFactor * (isUpset ? 0.35 : 1);
  return Math.max(1, Math.round(base));
}

export function createRating(value = DEFAULT_RATING): number {
  return value;
}

/** Provisional teams get a higher K; established teams move more slowly. */
export function kFactorForTeam(
  gamesPlayed: number,
  baseK = DEFAULT_K_FACTOR,
  model: RatingModel = defaultRatingModel()
): number {
  if (gamesPlayed < model.provisionalThreshold) {
    return Math.round(baseK * model.provisionalKMultiplier);
  }
  if (gamesPlayed < model.establishedThreshold) {
    return baseK;
  }
  return Math.round(baseK * model.establishedKMultiplier);
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
  k = DEFAULT_K_FACTOR
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
  scoreB: number,
  model: RatingModel = defaultRatingModel()
): [TeamRating, TeamRating] {
  const k = (kFactorForTeam(teamA.gamesPlayed, DEFAULT_K_FACTOR, model) + kFactorForTeam(teamB.gamesPlayed, DEFAULT_K_FACTOR, model)) / 2;
  const [newRatingA, newRatingB] = updateRatings(
    teamA.rating,
    teamB.rating,
    scoreA,
    scoreB,
    k
  );

  return [
    applyRatingUpdate(teamA, newRatingA, model),
    applyRatingUpdate(teamB, newRatingB, model),
  ];
}
