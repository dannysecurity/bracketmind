import { buildBracket } from "../domain/buildBracket.js";
import { bracketOrderingForTeams } from "../domain/teams.js";
import { matchIndex } from "../bracket/layout.js";
import { roundLabel } from "../display/roundLabels.js";
import type { Bracket, Team } from "../types.js";
import { isByeTeam } from "../types.js";
import { computeSubtreeDistribution } from "./bracketPaths.js";
import { buildSeedMap } from "./seeds.js";
import {
  DEFAULT_HISTORICAL_WEIGHT,
  forecastMatchupUpset,
  type SeedUpsetRateSource,
  type UpsetOutlookOptions,
} from "./seedUpsets.js";

export type { UpsetOutlookOptions };

export interface UpsetCandidate {
  round: number;
  slot: number;
  roundLabel: string;
  teamA: Team;
  teamB: Team;
  seedA: number | null;
  seedB: number | null;
  /** Probability both teams reach this bracket slot. */
  meetingProbability: number;
  /** Pre-game Elo upset probability for the lower-rated team. */
  eloUpsetProbability: number;
  /** Historical NCAA seed-pair upset rate when seeds are known. */
  historicalUpsetProbability: number | null;
  historicalRateSource: SeedUpsetRateSource | null;
  /** Blended upset probability used for ranking and expectations. */
  upsetProbability: number;
  /** meetingProbability × upsetProbability — expected upset mass at this slot. */
  upsetExpectation: number;
  /** True when both teams are fixed in round one. */
  isKnownMatchup: boolean;
}

export interface RoundUpsetSummary {
  round: number;
  roundLabel: string;
  candidates: UpsetCandidate[];
  mostLikelyUpset: UpsetCandidate | null;
  averageUpsetProbability: number | null;
}

export interface UpsetLandscape {
  bracket: Bracket;
  roundSummaries: RoundUpsetSummary[];
  mostLikelyUpsetOverall: UpsetCandidate | null;
}

function seedForTeam(seeds: Map<string, number>, team: Team): number | null {
  return isByeTeam(team) ? null : (seeds.get(team.id) ?? team.seed ?? null);
}

function buildUpsetCandidate(
  round: number,
  slot: number,
  bracket: Bracket,
  teamA: Team,
  teamB: Team,
  seeds: Map<string, number>,
  meetingProbability: number,
  isKnownMatchup: boolean,
  historicalWeight: number
): UpsetCandidate | null {
  const seedA = seedForTeam(seeds, teamA);
  const seedB = seedForTeam(seeds, teamB);
  const forecast = forecastMatchupUpset(
    teamA,
    teamB,
    seedA,
    seedB,
    historicalWeight,
    round
  );
  if (forecast.upsetProbability === null) {
    return null;
  }

  return {
    round,
    slot,
    roundLabel: roundLabel(round, bracket.rounds),
    teamA,
    teamB,
    seedA,
    seedB,
    meetingProbability,
    eloUpsetProbability: forecast.eloUpsetProbability!,
    historicalUpsetProbability: forecast.historicalUpsetProbability,
    historicalRateSource: forecast.historicalRateSource,
    upsetProbability: forecast.upsetProbability,
    upsetExpectation: meetingProbability * forecast.upsetProbability,
    isKnownMatchup,
  };
}

function buildKnownMatchupCandidate(
  bracket: Bracket,
  round: number,
  slot: number,
  seeds: Map<string, number>,
  historicalWeight: number
): UpsetCandidate | null {
  const match = bracket.matches[matchIndex(round, slot, bracket.rounds)];
  const teamA = match.teamA;
  const teamB = match.teamB;
  if (!teamA || !teamB) {
    return null;
  }

  return buildUpsetCandidate(
    round,
    slot,
    bracket,
    teamA,
    teamB,
    seeds,
    1,
    true,
    historicalWeight
  );
}

function buildExpectedMatchupCandidates(
  bracket: Bracket,
  round: number,
  slot: number,
  seeds: Map<string, number>,
  historicalWeight: number
): UpsetCandidate[] {
  const leftDist = computeSubtreeDistribution(bracket, round - 1, slot * 2);
  const rightDist = computeSubtreeDistribution(
    bracket,
    round - 1,
    slot * 2 + 1
  );
  const candidates: UpsetCandidate[] = [];

  for (const [idA, reachA] of leftDist) {
    for (const [idB, reachB] of rightDist) {
      const teamA = bracket.teams.find((team) => team.id === idA)!;
      const teamB = bracket.teams.find((team) => team.id === idB)!;
      const candidate = buildUpsetCandidate(
        round,
        slot,
        bracket,
        teamA,
        teamB,
        seeds,
        reachA * reachB,
        false,
        historicalWeight
      );
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates.sort((a, b) => b.upsetExpectation - a.upsetExpectation);
}

function summarizeRound(
  bracket: Bracket,
  round: number,
  seeds: Map<string, number>,
  historicalWeight: number
): RoundUpsetSummary {
  const slots = Math.pow(2, bracket.rounds - round - 1);
  const candidates: UpsetCandidate[] = [];

  for (let slot = 0; slot < slots; slot++) {
    if (round === 0) {
      const candidate = buildKnownMatchupCandidate(
        bracket,
        round,
        slot,
        seeds,
        historicalWeight
      );
      if (candidate) {
        candidates.push(candidate);
      }
    } else {
      candidates.push(
        ...buildExpectedMatchupCandidates(
          bracket,
          round,
          slot,
          seeds,
          historicalWeight
        )
      );
    }
  }

  candidates.sort((a, b) => b.upsetExpectation - a.upsetExpectation);
  const playable = candidates.filter(
    (candidate) => candidate.upsetProbability > 0
  );
  const averageUpsetProbability =
    playable.length > 0
      ? playable.reduce((sum, candidate) => sum + candidate.upsetProbability, 0) /
        playable.length
      : null;

  return {
    round,
    roundLabel: roundLabel(round, bracket.rounds),
    candidates,
    mostLikelyUpset: candidates[0] ?? null,
    averageUpsetProbability,
  };
}

/** Analyze upset probabilities for every bracket round using path-weighted Elo math. */
export function analyzeUpsetLandscape(
  teams: Team[],
  options: UpsetOutlookOptions = {}
): UpsetLandscape {
  const historicalWeight =
    options.historicalWeight ?? DEFAULT_HISTORICAL_WEIGHT;
  const bracket = buildBracket(teams, {
    ordering: bracketOrderingForTeams(teams),
  });
  const seeds = buildSeedMap(bracket.teams);
  const roundSummaries: RoundUpsetSummary[] = [];

  for (let round = 0; round < bracket.rounds; round++) {
    roundSummaries.push(
      summarizeRound(bracket, round, seeds, historicalWeight)
    );
  }

  const allCandidates = roundSummaries.flatMap((summary) => summary.candidates);
  allCandidates.sort((a, b) => b.upsetExpectation - a.upsetExpectation);

  return {
    bracket,
    roundSummaries,
    mostLikelyUpsetOverall: allCandidates[0] ?? null,
  };
}

/** Pick the candidate with the highest upset expectation. */
export function mostLikelyUpsetCandidate(
  candidates: UpsetCandidate[]
): UpsetCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, current) =>
    current.upsetExpectation > best.upsetExpectation ? current : best
  );
}
