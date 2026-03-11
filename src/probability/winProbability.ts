import { expectedScore } from "../ratings.js";
import type { SimulationOptions, Team } from "../types.js";
import { forecastMatchupUpset } from "./seedUpsets.js";

/**
 * True when team A is the underdog by rating, or by seed when ratings are equal.
 */
export function isUnderdogTeamA(
  ratingA: number,
  ratingB: number,
  seedA: number,
  seedB: number
): boolean {
  if (ratingA !== ratingB) {
    return ratingA < ratingB;
  }

  return seedA > seedB;
}

/**
 * Resolve team A's pre-game win probability for a single-game simulation.
 *
 * When both tournament seeds and a positive historical weight are provided,
 * blends Elo with NCAA historical upset rates before the outcome roll.
 */
export function resolveWinProbabilityA(
  teamA: Team,
  teamB: Team,
  ratingA: number,
  ratingB: number,
  options: SimulationOptions
): number {
  const eloWinProbA = expectedScore(ratingA, ratingB);
  const { seedA, seedB, historicalWeight, round } = options;

  if (
    seedA === undefined ||
    seedB === undefined ||
    historicalWeight === undefined ||
    historicalWeight <= 0
  ) {
    return eloWinProbA;
  }

  const forecast = forecastMatchupUpset(
    teamA,
    teamB,
    seedA,
    seedB,
    historicalWeight,
    round ?? 0
  );

  if (forecast.upsetProbability === null) {
    return eloWinProbA;
  }

  return isUnderdogTeamA(ratingA, ratingB, seedA, seedB)
    ? forecast.upsetProbability
    : 1 - forecast.upsetProbability;
}
