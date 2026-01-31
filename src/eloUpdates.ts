import {
  EVEN_MATCHUP_EXPECTED_MARGIN,
  expectedMarginFromRatings,
  expectedScore,
  kFactorForTeam,
  type TeamRating,
} from "./ratings.js";
import {
  defaultRatingModel,
  type RatingModel,
} from "./ratingsModel.js";

/** Context for scaling Elo updates by game situation and bracket stage. */
export interface GameRatingContext {
  /** 0-based round index within the bracket. */
  round: number;
  /** Total rounds in the bracket (log2 of field size). */
  totalRounds: number;
  /** Absolute point margin of the finished game. */
  margin: number;
  /** True when the lower-rated team won. */
  isUpset: boolean;
}

/**
 * Map a win/loss plus margin to an Elo "actual" score in [0, 1].
 * Blowouts count as fully decisive; nail-biters give partial credit to the loser.
 *
 * When winner/loser ratings are provided, the margin cap scales with the
 * expected margin for that matchup so a 15-point favorite win counts less
 * than the same margin between evenly matched teams.
 */
export function actualScoreFromGame(
  won: boolean,
  margin: number,
  movCap = defaultRatingModel().movCap,
  winnerRating?: number,
  loserRating?: number
): number {
  let effectiveMovCap = movCap;
  if (winnerRating !== undefined && loserRating !== undefined) {
    const expected = expectedMarginFromRatings(winnerRating, loserRating);
    effectiveMovCap =
      movCap * (expected / EVEN_MATCHUP_EXPECTED_MARGIN);
  }

  const clamped = Math.max(0, Math.min(margin, effectiveMovCap));
  const decisiveness = 0.5 + 0.5 * (clamped / effectiveMovCap);
  return won ? decisiveness : 1 - decisiveness;
}

/** Later bracket rounds carry more rating weight than early ones. */
export function roundKMultiplier(
  round: number,
  totalRounds: number,
  model: RatingModel = defaultRatingModel()
): number {
  if (totalRounds <= 1) {
    return 1;
  }
  const progress = round / (totalRounds - 1);
  return model.roundKMin + model.roundKRange * progress;
}

/** Combine provisional K with round-based scaling. */
export function contextualKFactor(
  team: TeamRating,
  context: GameRatingContext,
  model: RatingModel = defaultRatingModel()
): number {
  const provisional = kFactorForTeam(
    team.gamesPlayed,
    model.baseKFactor,
    model
  );
  return Math.round(
    provisional * roundKMultiplier(context.round, context.totalRounds, model)
  );
}

function applyUpsetBonus(
  actualA: number,
  actualB: number,
  ratingA: number,
  ratingB: number,
  winnerIsA: boolean,
  isUpset: boolean,
  upsetBonus: number
): [number, number] {
  if (!isUpset || ratingA === ratingB) {
    return [actualA, actualB];
  }

  if (winnerIsA) {
    return [
      Math.min(1, actualA + upsetBonus),
      Math.max(0, actualB - upsetBonus),
    ];
  }
  return [
    Math.max(0, actualA - upsetBonus),
    Math.min(1, actualB + upsetBonus),
  ];
}

/** Derive margin- and upset-adjusted actual scores for both teams. */
export function computeActualScores(
  scoreA: number,
  scoreB: number,
  context: GameRatingContext,
  ratingA: number,
  ratingB: number,
  model: RatingModel = defaultRatingModel()
): [number, number] {
  if (scoreA === scoreB) {
    return [0.5, 0.5];
  }

  const winnerIsA = scoreA > scoreB;
  const winnerRating = winnerIsA ? ratingA : ratingB;
  const loserRating = winnerIsA ? ratingB : ratingA;
  let actualA = actualScoreFromGame(
    winnerIsA,
    context.margin,
    model.movCap,
    winnerRating,
    loserRating
  );
  let actualB = actualScoreFromGame(
    !winnerIsA,
    context.margin,
    model.movCap,
    winnerRating,
    loserRating
  );

  return applyUpsetBonus(
    actualA,
    actualB,
    ratingA,
    ratingB,
    winnerIsA,
    context.isUpset,
    model.upsetBonus
  );
}

/** Apply a contextual Elo update using precomputed actual scores. */
export function updateRatingsWithContext(
  ratingA: number,
  ratingB: number,
  actualA: number,
  actualB: number,
  k: number
): [number, number] {
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;

  return [
    Math.round(ratingA + k * (actualA - expectedA)),
    Math.round(ratingB + k * (actualB - expectedB)),
  ];
}

/** Update tracked team ratings with margin, round, and upset-aware logic. */
export function updateTeamRatingsWithContext(
  teamA: TeamRating,
  teamB: TeamRating,
  scoreA: number,
  scoreB: number,
  context: GameRatingContext,
  model: RatingModel = defaultRatingModel()
): [TeamRating, TeamRating] {
  const k =
    (contextualKFactor(teamA, context, model) +
      contextualKFactor(teamB, context, model)) /
    2;
  const [actualA, actualB] = computeActualScores(
    scoreA,
    scoreB,
    context,
    teamA.rating,
    teamB.rating,
    model
  );
  const [newRatingA, newRatingB] = updateRatingsWithContext(
    teamA.rating,
    teamB.rating,
    actualA,
    actualB,
    k
  );

  return [
    { rating: newRatingA, gamesPlayed: teamA.gamesPlayed + 1 },
    { rating: newRatingB, gamesPlayed: teamB.gamesPlayed + 1 },
  ];
}
