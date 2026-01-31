/**
 * Tunable parameters for Elo rating updates.
 *
 * Centralizes magic numbers that were previously scattered across
 * `ratings.ts` and `eloUpdates.ts`, enabling backtesting and
 * experimentation without touching core update logic.
 */
export interface RatingModel {
  /** Starting Elo for teams with no prior rating. */
  defaultRating: number;
  /** Base K-factor before provisional and round scaling. */
  baseKFactor: number;
  /** Margin-of-victory cap for actual-score computation. */
  movCap: number;
  /** Bonus applied to upset winner actual score (subtracted from loser). */
  upsetBonus: number;
  /** Games below this threshold use provisional (elevated) K. */
  provisionalThreshold: number;
  /** Multiplier on base K for provisional teams. */
  provisionalKMultiplier: number;
  /** Games at or above this threshold use established (reduced) K. */
  establishedThreshold: number;
  /** Multiplier on base K for established teams. */
  establishedKMultiplier: number;
  /** Round K multiplier at the first bracket round. */
  roundKMin: number;
  /** Additional round K multiplier added by the championship round. */
  roundKRange: number;
}

/** Production defaults matching pre-model behavior. */
export function defaultRatingModel(): RatingModel {
  return {
    defaultRating: 1500,
    baseKFactor: 32,
    movCap: 20,
    upsetBonus: 0.08,
    provisionalThreshold: 10,
    provisionalKMultiplier: 1.25,
    establishedThreshold: 30,
    establishedKMultiplier: 0.8,
    roundKMin: 0.9,
    roundKRange: 0.3,
  };
}

/** Build a model by overriding selected fields from the defaults. */
export function createRatingModel(
  overrides: Partial<RatingModel> = {}
): RatingModel {
  return { ...defaultRatingModel(), ...overrides };
}
