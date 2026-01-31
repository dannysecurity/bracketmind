import { buildSeedMap } from "./seeds.js";
import {
  lookupHistoricalUpsetRate,
  lookupHistoricalSeedUpsetRate,
  type SeedUpsetRateLookup,
  type SeedUpsetRateSource,
} from "./historicalRates.js";
import { matchupUpsetProbability } from "./matchup.js";
import type { Bracket, Team } from "../types.js";

export type { SeedUpsetRateLookup, SeedUpsetRateSource };
export { lookupHistoricalSeedUpsetRate, lookupHistoricalUpsetRate };

export interface RoundOneUpsetOutlook {
  slot: number;
  teamA: Team;
  teamB: Team;
  seedA: number | null;
  seedB: number | null;
  favoriteSeed: number | null;
  underdogSeed: number | null;
  eloUpsetProbability: number | null;
  historicalUpsetProbability: number | null;
  historicalRateSource: SeedUpsetRateSource | null;
  blendedUpsetProbability: number | null;
  isByeMatch: boolean;
}

export interface TournamentUpsetOutlook {
  matchups: RoundOneUpsetOutlook[];
  /** Sum of blended upset probabilities across playable round-one games. */
  expectedRoundOneUpsets: number;
  mostLikelyUpset: RoundOneUpsetOutlook | null;
}

export interface UpsetOutlookOptions {
  /** Weight given to historical seed rates when blending with Elo (0–1). Default 0.35. */
  historicalWeight?: number;
}

export interface MatchupUpsetForecast {
  eloUpsetProbability: number | null;
  historicalUpsetProbability: number | null;
  historicalRateSource: SeedUpsetRateSource | null;
  /** Blended upset probability; equals Elo when seeds or Elo are unavailable. */
  upsetProbability: number | null;
}

/** Default blend weight for historical NCAA seed upset rates vs Elo forecasts. */
export const DEFAULT_HISTORICAL_WEIGHT = 0.35;

/** Blend Elo and historical seed upset probabilities into a single forecast. */
export function blendUpsetProbabilities(
  eloProbability: number,
  historicalProbability: number,
  historicalWeight = DEFAULT_HISTORICAL_WEIGHT
): number {
  const weight = Math.min(1, Math.max(0, historicalWeight));
  return eloProbability * (1 - weight) + historicalProbability * weight;
}

/** Forecast upset probability for a pairing, blending Elo with round-aware historical seed rates. */
export function forecastMatchupUpset(
  teamA: Team,
  teamB: Team,
  seedA: number | null,
  seedB: number | null,
  historicalWeight = DEFAULT_HISTORICAL_WEIGHT,
  round = 0
): MatchupUpsetForecast {
  const eloUpsetProbability = matchupUpsetProbability(teamA, teamB);
  if (eloUpsetProbability === null || seedA === null || seedB === null) {
    return {
      eloUpsetProbability,
      historicalUpsetProbability: null,
      historicalRateSource: null,
      upsetProbability: eloUpsetProbability,
    };
  }

  const lookup = lookupHistoricalUpsetRate(seedA, seedB, round);
  return {
    eloUpsetProbability,
    historicalUpsetProbability: lookup.historicalRate,
    historicalRateSource: lookup.source,
    upsetProbability: blendUpsetProbabilities(
      eloUpsetProbability,
      lookup.historicalRate,
      historicalWeight
    ),
  };
}

function buildRoundOneOutlook(
  slot: number,
  teamA: Team,
  teamB: Team,
  seedA: number | null,
  seedB: number | null,
  historicalWeight: number
): RoundOneUpsetOutlook {
  const isByeMatch = teamA.name === "BYE" || teamB.name === "BYE";
  if (isByeMatch || seedA === null || seedB === null) {
    return {
      slot,
      teamA,
      teamB,
      seedA,
      seedB,
      favoriteSeed: null,
      underdogSeed: null,
      eloUpsetProbability: null,
      historicalUpsetProbability: null,
      historicalRateSource: null,
      blendedUpsetProbability: null,
      isByeMatch,
    };
  }

  const forecast = forecastMatchupUpset(
    teamA,
    teamB,
    seedA,
    seedB,
    historicalWeight,
    0
  );

  return {
    slot,
    teamA,
    teamB,
    seedA,
    seedB,
    favoriteSeed: Math.min(seedA, seedB),
    underdogSeed: Math.max(seedA, seedB),
    eloUpsetProbability: forecast.eloUpsetProbability,
    historicalUpsetProbability: forecast.historicalUpsetProbability,
    historicalRateSource: forecast.historicalRateSource,
    blendedUpsetProbability: forecast.upsetProbability,
    isByeMatch: false,
  };
}

/** Analyze round-one upset probabilities using Elo, historical seed rates, and a blended forecast. */
export function analyzeRoundOneUpsetOutlook(
  bracket: Bracket,
  options: UpsetOutlookOptions = {}
): TournamentUpsetOutlook {
  const historicalWeight =
    options.historicalWeight ?? DEFAULT_HISTORICAL_WEIGHT;
  const seeds = buildSeedMap(bracket.teams);
  const matchups = bracket.matches
    .filter((match) => match.round === 0)
    .sort((a, b) => a.slot - b.slot)
    .map((match) => {
      const teamA = match.teamA!;
      const teamB = match.teamB!;
      const seedA = teamA.name === "BYE" ? null : (seeds.get(teamA.id) ?? null);
      const seedB = teamB.name === "BYE" ? null : (seeds.get(teamB.id) ?? null);

      return buildRoundOneOutlook(
        match.slot,
        teamA,
        teamB,
        seedA,
        seedB,
        historicalWeight
      );
    });

  const playable = matchups.filter(
    (matchup) => matchup.blendedUpsetProbability !== null
  );
  const expectedRoundOneUpsets = playable.reduce(
    (sum, matchup) => sum + matchup.blendedUpsetProbability!,
    0
  );
  const mostLikelyUpset =
    playable.length === 0
      ? null
      : playable.reduce((best, current) =>
          current.blendedUpsetProbability! > best.blendedUpsetProbability!
            ? current
            : best
        );

  return {
    matchups,
    expectedRoundOneUpsets,
    mostLikelyUpset,
  };
}
