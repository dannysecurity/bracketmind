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

const SCORE_MODEL_FIELDS: (keyof ScoreModel)[] = [
  "baseWinnerScore",
  "winnerScoreSpread",
  "loserScoreFloor",
  "marginNoiseRange",
];

/** Reject invalid score-model overrides before they reach generateScores. */
export function validateScoreModel(model: ScoreModel): void {
  for (const field of SCORE_MODEL_FIELDS) {
    const value = model[field];
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`${field} must be a finite integer`);
    }
  }

  if (model.baseWinnerScore < 0) {
    throw new Error("baseWinnerScore must be non-negative");
  }
  if (model.winnerScoreSpread < 0) {
    throw new Error("winnerScoreSpread must be non-negative");
  }
  if (model.loserScoreFloor < 0) {
    throw new Error("loserScoreFloor must be non-negative");
  }
  if (model.marginNoiseRange < 0) {
    throw new Error("marginNoiseRange must be non-negative");
  }
}

/** Build a score model by overriding selected fields from the defaults. */
export function createScoreModel(
  overrides: Partial<ScoreModel> = {}
): ScoreModel {
  const model = { ...defaultScoreModel(), ...overrides };
  validateScoreModel(model);
  return model;
}
