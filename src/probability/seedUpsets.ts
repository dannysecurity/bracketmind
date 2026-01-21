import { buildSeedMap } from "./seeds.js";
import { matchupUpsetProbability } from "./matchup.js";
import type { Bracket, Team } from "../types.js";

/** Historical first-round upset rates (underdog wins), aggregated from NCAA tournaments 1985–2024. */
const CANONICAL_FIRST_ROUND_RATES: Readonly<Record<string, number>> = {
  "1-16": 0.01,
  "2-15": 0.06,
  "3-14": 0.15,
  "4-13": 0.21,
  "5-12": 0.35,
  "6-11": 0.37,
  "7-10": 0.4,
  "8-9": 0.48,
};

/** Fallback upset rates by seed gap when the pairing is not a canonical first-round slot. */
const SEED_GAP_UPSET_RATES: Readonly<Record<number, number>> = {
  0: 0.5,
  1: 0.48,
  2: 0.35,
  3: 0.25,
  4: 0.18,
  5: 0.1,
  6: 0.06,
  7: 0.03,
  8: 0.01,
};

export type SeedUpsetRateSource = "canonical-first-round" | "seed-gap-model";

export interface SeedUpsetRateLookup {
  favoriteSeed: number;
  underdogSeed: number;
  seedGap: number;
  /** Probability the higher seed number (underdog) wins. */
  historicalRate: number;
  source: SeedUpsetRateSource;
}

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

const DEFAULT_HISTORICAL_WEIGHT = 0.35;

function canonicalPairKey(favoriteSeed: number, underdogSeed: number): string {
  return `${favoriteSeed}-${underdogSeed}`;
}

function rateForSeedGap(seedGap: number): number {
  if (seedGap <= 0) {
    return SEED_GAP_UPSET_RATES[0];
  }
  if (seedGap >= 8) {
    return SEED_GAP_UPSET_RATES[8];
  }
  return SEED_GAP_UPSET_RATES[seedGap] ?? SEED_GAP_UPSET_RATES[8];
}

/** Look up the historical upset rate for a seed pairing (lower seed number is the favorite). */
export function lookupHistoricalSeedUpsetRate(
  seedA: number,
  seedB: number
): SeedUpsetRateLookup {
  const favoriteSeed = Math.min(seedA, seedB);
  const underdogSeed = Math.max(seedA, seedB);
  const seedGap = underdogSeed - favoriteSeed;
  const canonicalKey = canonicalPairKey(favoriteSeed, underdogSeed);
  const canonicalRate = CANONICAL_FIRST_ROUND_RATES[canonicalKey];

  if (canonicalRate !== undefined) {
    return {
      favoriteSeed,
      underdogSeed,
      seedGap,
      historicalRate: canonicalRate,
      source: "canonical-first-round",
    };
  }

  return {
    favoriteSeed,
    underdogSeed,
    seedGap,
    historicalRate: rateForSeedGap(seedGap),
    source: "seed-gap-model",
  };
}

/** Blend Elo and historical seed upset probabilities into a single forecast. */
export function blendUpsetProbabilities(
  eloProbability: number,
  historicalProbability: number,
  historicalWeight = DEFAULT_HISTORICAL_WEIGHT
): number {
  const weight = Math.min(1, Math.max(0, historicalWeight));
  return eloProbability * (1 - weight) + historicalProbability * weight;
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

  const lookup = lookupHistoricalSeedUpsetRate(seedA, seedB);
  const eloUpsetProbability = matchupUpsetProbability(teamA, teamB);
  const blendedUpsetProbability =
    eloUpsetProbability === null
      ? null
      : blendUpsetProbabilities(
          eloUpsetProbability,
          lookup.historicalRate,
          historicalWeight
        );

  return {
    slot,
    teamA,
    teamB,
    seedA,
    seedB,
    favoriteSeed: lookup.favoriteSeed,
    underdogSeed: lookup.underdogSeed,
    eloUpsetProbability,
    historicalUpsetProbability: lookup.historicalRate,
    historicalRateSource: lookup.source,
    blendedUpsetProbability,
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
