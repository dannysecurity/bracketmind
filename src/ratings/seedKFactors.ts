import { lookupHistoricalUpsetRate } from "../probability/historicalRates.js";
import {
  defaultRatingModel,
  type RatingModel,
} from "../ratingsModel.js";

/** Bracket and outcome context for seed-aware K scaling. */
export interface SeedKMatchupContext {
  /** 0-based round index within the bracket. */
  round: number;
  /** True when the lower-rated team won. */
  isUpset: boolean;
}

/**
 * Matchup-level K multiplier derived from NCAA seed pairings.
 *
 * Rare seed upsets boost K for both teams; chalk favorite wins dampen K.
 * The multiplier is symmetric so paired updates remain approximately zero-sum.
 */
export function seedKMultiplierForMatchup(
  seedA: number | undefined,
  seedB: number | undefined,
  context: SeedKMatchupContext,
  model: RatingModel = defaultRatingModel()
): number {
  if (!hasSeedPair(seedA, seedB) || model.seedKWeight <= 0) {
    return 1;
  }

  const lookup = lookupHistoricalUpsetRate(seedA, seedB, context.round);
  const upsetRarity = 1 - lookup.historicalRate;
  const weight = model.seedKWeight;

  if (context.isUpset) {
    return 1 + weight * upsetRarity * model.seedKUpsetBoostMax;
  }

  return 1 - weight * upsetRarity * model.seedKExpectedWinDampen;
}

/** True when both seeds are finite positive integers. */
export function hasSeedPair(
  seedA: number | undefined,
  seedB: number | undefined
): seedA is number {
  return (
    seedA !== undefined &&
    seedB !== undefined &&
    Number.isFinite(seedA) &&
    Number.isFinite(seedB) &&
    seedA > 0 &&
    seedB > 0
  );
}
