import {
  defaultRatingModel,
  type RatingModel,
} from "../ratingsModel.js";

/** Mutable per-team rating state tracked during a tournament or season replay. */
export interface TeamRating {
  rating: number;
  gamesPlayed: number;
  /** Rating deviation — higher values mean less confidence in the current rating. */
  ratingDeviation: number;
  /** Highest rating reached during the tracked run. */
  peakRating: number;
  /** Rating change from the most recent game (0 before any games). */
  lastDelta: number;
}

export interface CreateTeamRatingOptions {
  gamesPlayed?: number;
  ratingDeviation?: number;
}

/** Rating deviation after a given number of completed games. */
export function ratingDeviationAfterGames(
  gamesPlayed: number,
  model: RatingModel = defaultRatingModel()
): number {
  const decayed =
    model.initialRatingDeviation - gamesPlayed * model.rdDecayPerGame;
  return Math.max(model.minRatingDeviation, decayed);
}

/** Build initial rating state for a team entering a tracked run. */
export function createTeamRating(
  rating = defaultRatingModel().defaultRating,
  options: CreateTeamRatingOptions = {},
  model: RatingModel = defaultRatingModel()
): TeamRating {
  const gamesPlayed = options.gamesPlayed ?? 0;
  const ratingDeviation =
    options.ratingDeviation ?? ratingDeviationAfterGames(gamesPlayed, model);

  return {
    rating,
    gamesPlayed,
    ratingDeviation,
    peakRating: rating,
    lastDelta: 0,
  };
}

/** True when the team is still in the provisional K-factor window. */
export function isProvisionalTeamRating(
  team: TeamRating,
  model: RatingModel = defaultRatingModel()
): boolean {
  return team.gamesPlayed < model.provisionalThreshold;
}

/**
 * Scale K-factor by rating confidence.
 * High deviation (uncertain teams) keep full K; low deviation dampens swings.
 */
export function confidenceKMultiplier(
  ratingDeviation: number,
  model: RatingModel = defaultRatingModel()
): number {
  const span = model.initialRatingDeviation - model.minRatingDeviation;
  if (span <= 0) {
    return 1;
  }
  const progress =
    (ratingDeviation - model.minRatingDeviation) / span;
  return model.rdKMin + model.rdKRange * Math.max(0, Math.min(1, progress));
}

/** Apply a rating change and advance games-played / deviation state. */
export function applyRatingUpdate(
  team: TeamRating,
  newRating: number,
  model: RatingModel = defaultRatingModel()
): TeamRating {
  const lastDelta = newRating - team.rating;
  const gamesPlayed = team.gamesPlayed + 1;

  return {
    rating: newRating,
    gamesPlayed,
    ratingDeviation: ratingDeviationAfterGames(gamesPlayed, model),
    peakRating: Math.max(team.peakRating, newRating),
    lastDelta,
  };
}

/** Sync rating-deviation state when seeding prior games-played counts. */
export function withPriorGamesPlayed(
  team: TeamRating,
  gamesPlayed: number,
  model: RatingModel = defaultRatingModel()
): TeamRating {
  return {
    ...team,
    gamesPlayed,
    ratingDeviation: ratingDeviationAfterGames(gamesPlayed, model),
  };
}
