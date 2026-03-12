/**
 * Tunable parameters for simulated game scores.
 *
 * Mirrors the `RatingModel` pattern: centralizes score-generation constants
 * so backtests and experiments can calibrate pace and margin noise without
 * touching core simulation logic.
 */
export interface ScoreModel {
  /** Baseline winning score before spread and margin adjustments. */
  baseWinnerScore: number;
  /** Uniform random spread added to the winner's score (0 to spread - 1). */
  winnerScoreSpread: number;
  /** Floor for the losing team's score before rebalancing margin. */
  loserScoreFloor: number;
  /** Half-width of uniform margin noise added to the expected margin. */
  marginNoiseRange: number;
}

/** Production defaults matching pre-model behavior. */
export function defaultScoreModel(): ScoreModel {
  return {
    baseWinnerScore: 68,
    winnerScoreSpread: 12,
    loserScoreFloor: 55,
    marginNoiseRange: 5,
  };
}

/** Build a score model by overriding selected fields from the defaults. */
export function createScoreModel(
  overrides: Partial<ScoreModel> = {}
): ScoreModel {
  return { ...defaultScoreModel(), ...overrides };
}
