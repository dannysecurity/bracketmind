import { buildBracket } from "../domain/buildBracket.js";
import { bracketOrderingForTeams } from "../domain/teams.js";
import { isByeTeam, type Team } from "../types.js";
import {
  analyzeUpsetLandscape,
  type UpsetCandidate,
  type UpsetLandscape,
} from "./analytics.js";
import { buildSeedMap } from "./seeds.js";
import {
  analyzeRoundOneUpsetOutlook,
  DEFAULT_HISTORICAL_WEIGHT,
  type TournamentUpsetOutlook,
  type UpsetOutlookOptions,
} from "./seedUpsets.js";

export type { UpsetOutlookOptions };

export interface RoundUpsetExposure {
  round: number;
  roundLabel: string;
  /** Sum of path-weighted upset expectations for the round. */
  expectedUpsets: number;
  topCandidate: UpsetCandidate | null;
}

export interface SeedLineExposure {
  seed: number;
  teamName: string;
  /** Aggregate upset expectation mass when this team is the underdog. */
  underdogExposure: number;
  /** Blended round-one upset chance when the team has a first-round game. */
  roundOneUpsetChance: number | null;
}

export interface TournamentUpsetIndex {
  landscape: UpsetLandscape;
  roundOneOutlook: TournamentUpsetOutlook;
  /** Path-weighted expected upsets summed across every bracket round. */
  expectedTotalUpsets: number;
  /**
   * 0–100 stability score for the field.
   * 100 means no expected upsets; 0 means every game is an expected upset.
   */
  chalkIndex: number;
  roundExposures: RoundUpsetExposure[];
  seedLineExposures: SeedLineExposure[];
  mostVolatileSeedLine: SeedLineExposure | null;
}

function upsetCapacity(teams: Team[]): number {
  const playableTeams = teams.filter((team) => !isByeTeam(team)).length;
  return Math.max(1, playableTeams - 1);
}

function computeChalkIndex(expectedTotalUpsets: number, capacity: number): number {
  const ratio = Math.min(1, Math.max(0, expectedTotalUpsets / capacity));
  return Math.round(100 * (1 - ratio));
}

function underdogTeam(candidate: UpsetCandidate): Team {
  if (candidate.teamA.rating !== candidate.teamB.rating) {
    return candidate.teamA.rating < candidate.teamB.rating
      ? candidate.teamA
      : candidate.teamB;
  }

  const seedA = candidate.seedA ?? Infinity;
  const seedB = candidate.seedB ?? Infinity;
  return seedA > seedB ? candidate.teamA : candidate.teamB;
}

function buildSeedLineExposures(
  landscape: UpsetLandscape,
  roundOneOutlook: TournamentUpsetOutlook,
  seeds: Map<string, number>
): SeedLineExposure[] {
  const exposureByTeam = new Map<
    string,
    {
      seed: number;
      teamName: string;
      underdogExposure: number;
      roundOneUpsetChance: number | null;
    }
  >();

  for (const summary of landscape.roundSummaries) {
    for (const candidate of summary.candidates) {
      const underdog = underdogTeam(candidate);
      const seed = seeds.get(underdog.id);
      if (seed === undefined) {
        continue;
      }

      const current = exposureByTeam.get(underdog.id) ?? {
        seed,
        teamName: underdog.name,
        underdogExposure: 0,
        roundOneUpsetChance: null,
      };
      current.underdogExposure += candidate.upsetExpectation;
      exposureByTeam.set(underdog.id, current);
    }
  }

  for (const matchup of roundOneOutlook.matchups) {
    if (matchup.isByeMatch || matchup.blendedUpsetProbability === null) {
      continue;
    }

    const underdog =
      matchup.teamA.rating !== matchup.teamB.rating
        ? matchup.teamA.rating < matchup.teamB.rating
          ? matchup.teamA
          : matchup.teamB
        : (matchup.seedA ?? Infinity) > (matchup.seedB ?? Infinity)
          ? matchup.teamA
          : matchup.teamB;
    const current = exposureByTeam.get(underdog.id);
    if (current) {
      current.roundOneUpsetChance = matchup.blendedUpsetProbability;
    }
  }

  return [...exposureByTeam.values()]
    .map((entry) => ({
      seed: entry.seed,
      teamName: entry.teamName,
      underdogExposure: entry.underdogExposure,
      roundOneUpsetChance: entry.roundOneUpsetChance,
    }))
    .sort((a, b) => b.underdogExposure - a.underdogExposure);
}

/** Summarize tournament-wide upset volatility from seeding and path-weighted forecasts. */
export function computeTournamentUpsetIndex(
  teams: Team[],
  options: UpsetOutlookOptions = {}
): TournamentUpsetIndex {
  const historicalWeight =
    options.historicalWeight ?? DEFAULT_HISTORICAL_WEIGHT;
  const landscape = analyzeUpsetLandscape(teams, { historicalWeight });
  const roundOneOutlook = analyzeRoundOneUpsetOutlook(landscape.bracket, {
    historicalWeight,
  });
  const seeds = buildSeedMap(landscape.bracket.teams);

  const expectedTotalUpsets = landscape.roundSummaries.reduce(
    (sum, summary) =>
      sum +
      summary.candidates.reduce(
        (roundSum, candidate) => roundSum + candidate.upsetExpectation,
        0
      ),
    0
  );

  const roundExposures = landscape.roundSummaries.map((summary) => ({
    round: summary.round,
    roundLabel: summary.roundLabel,
    expectedUpsets: summary.candidates.reduce(
      (sum, candidate) => sum + candidate.upsetExpectation,
      0
    ),
    topCandidate: summary.mostLikelyUpset,
  }));

  const seedLineExposures = buildSeedLineExposures(
    landscape,
    roundOneOutlook,
    seeds
  );

  const capacity = upsetCapacity(landscape.bracket.teams);

  return {
    landscape,
    roundOneOutlook,
    expectedTotalUpsets,
    chalkIndex: computeChalkIndex(expectedTotalUpsets, capacity),
    roundExposures,
    seedLineExposures,
    mostVolatileSeedLine: seedLineExposures[0] ?? null,
  };
}
