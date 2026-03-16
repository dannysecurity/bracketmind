import { lookupHistoricalUpsetRate } from "../probability/historicalRates.js";
import {
  blendUpsetProbabilities,
  forecastMatchupUpset,
} from "../probability/seedUpsets.js";
import { resolveWinProbabilityA } from "../probability/winProbability.js";
import type {
  BracketSimulationOptions,
  SimulationOptions,
  Team,
  TournamentState,
} from "../types.js";
import { team } from "./simulationFixtures.js";

/** Team with an NCAA-style seed for historical blend scenarios. */
export function seededTeam(
  name: string,
  rating: number,
  seed: number,
  id?: string
): Team {
  return { ...team(name, rating, id), seed };
}

/**
 * Build a field where the first `seededCount` teams carry seeds and the rest
 * do not. Useful for mixed-seed bracket edge cases.
 */
export function mixedSeedField(
  count: number,
  seededCount: number,
  topRating = 1700,
  step = 25
): Team[] {
  return Array.from({ length: count }, (_, index) => {
    const entry = team(`S${index + 1}`, topRating - index * step);
    return index < seededCount ? { ...entry, seed: index + 1 } : entry;
  });
}

/** Sum live ratings held in tournament state. */
export function totalStateRatingPoints(state: TournamentState): number {
  return Array.from(state.ratings.values()).reduce(
    (sum, entry) => sum + entry.rating,
    0
  );
}

/** Assert rating points are conserved within tolerance after a series. */
export function assertSeriesRatingConserved(
  beforeTotal: number,
  afterTotal: number,
  tolerance = 0.01
): void {
  if (Math.abs(beforeTotal - afterTotal) > tolerance) {
    throw new Error(
      `Series rating total changed: before=${beforeTotal}, after=${afterTotal}`
    );
  }
}

/** Team A win probability at a specific bracket round with historical blending. */
export function winProbabilityAtRound(
  teamA: Team,
  teamB: Team,
  round: number,
  historicalWeight: number
): number {
  const seedA = teamA.seed;
  const seedB = teamB.seed;
  if (seedA === undefined || seedB === undefined) {
    throw new Error("Both teams must carry seeds for round-aware probability");
  }

  return resolveWinProbabilityA(
    teamA,
    teamB,
    teamA.rating,
    teamB.rating,
    { seedA, seedB, historicalWeight, round }
  );
}

/** Historical upset rate for a seed pairing at a given bracket round. */
export function historicalRateAtRound(
  seedA: number,
  seedB: number,
  round: number
): number {
  return lookupHistoricalUpsetRate(seedA, seedB, round).historicalRate;
}

/**
 * Compare win probabilities for the same seeded pairing across two rounds.
 * Returns whether the historical lookup differs between those rounds.
 */
export function roundAwareProbabilityDiffers(
  seedA: number,
  seedB: number,
  roundA: number,
  roundB: number,
  historicalWeight: number,
  rating = 1500
): {
  probabilityAtRoundA: number;
  probabilityAtRoundB: number;
  historicalRateA: number;
  historicalRateB: number;
} {
  const teamA = seededTeam("TeamA", rating, seedA);
  const teamB = seededTeam("TeamB", rating, seedB);
  const historicalRateA = historicalRateAtRound(seedA, seedB, roundA);
  const historicalRateB = historicalRateAtRound(seedA, seedB, roundB);

  return {
    probabilityAtRoundA: winProbabilityAtRound(
      teamA,
      teamB,
      roundA,
      historicalWeight
    ),
    probabilityAtRoundB: winProbabilityAtRound(
      teamA,
      teamB,
      roundB,
      historicalWeight
    ),
    historicalRateA,
    historicalRateB,
  };
}

/** Bracket options that combine live rating updates with historical upset blending. */
export function combinedBracketOptions(
  overrides: Partial<BracketSimulationOptions> = {}
): BracketSimulationOptions {
  return {
    dynamicRatings: true,
    historicalWeight: 0.35,
    ...overrides,
  };
}

/** Single-game options for Monte Carlo or series tests with full blending enabled. */
export function fullBlendGameOptions(
  overrides: Partial<SimulationOptions> = {}
): SimulationOptions {
  return {
    historicalWeight: 1,
    ...overrides,
  };
}

/** Expected win probability when historical weight is clamped to [0, 1]. */
export function clampedBlendWinProbability(
  teamA: Team,
  teamB: Team,
  seedA: number,
  seedB: number,
  historicalWeight: number,
  round = 0
): number {
  const forecast = forecastMatchupUpset(
    teamA,
    teamB,
    seedA,
    seedB,
    Math.min(1, Math.max(0, historicalWeight)),
    round
  );

  if (forecast.upsetProbability === null) {
    return resolveWinProbabilityA(
      teamA,
      teamB,
      teamA.rating,
      teamB.rating,
      { seedA, seedB, historicalWeight: 0 }
    );
  }

  const ratingA = teamA.rating;
  const ratingB = teamB.rating;
  const isUnderdog =
    ratingA < ratingB || (ratingA === ratingB && seedA > seedB);

  return isUnderdog
    ? forecast.upsetProbability
    : 1 - forecast.upsetProbability;
}

/** Blended upset probability using explicit historical and Elo components. */
export function blendedUpsetAtRound(
  eloUpset: number,
  historicalRate: number,
  historicalWeight: number
): number {
  return blendUpsetProbabilities(eloUpset, historicalRate, historicalWeight);
}
