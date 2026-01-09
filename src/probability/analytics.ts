import { createBracket } from "../bracket.js";
import { roundLabel } from "../display/roundLabels.js";
import type { Bracket, Team } from "../types.js";
import { computeSubtreeDistribution } from "./bracketPaths.js";
import { matchupUpsetProbability } from "./matchup.js";
import { buildSeedMap } from "./seeds.js";

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
  /** Pre-game probability the lower-rated team wins, given they meet. */
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

function matchIndex(round: number, slot: number, rounds: number): number {
  let index = 0;
  for (let r = 0; r < round; r++) {
    index += Math.pow(2, rounds - r - 1);
  }
  return index + slot;
}

function seedForTeam(seeds: Map<string, number>, team: Team): number | null {
  return team.name === "BYE" ? null : (seeds.get(team.id) ?? null);
}

function buildKnownMatchupCandidate(
  bracket: Bracket,
  round: number,
  slot: number,
  seeds: Map<string, number>
): UpsetCandidate | null {
  const match = bracket.matches[matchIndex(round, slot, bracket.rounds)];
  const teamA = match.teamA;
  const teamB = match.teamB;
  if (!teamA || !teamB) {
    return null;
  }

  const upsetProbability = matchupUpsetProbability(teamA, teamB);
  if (upsetProbability === null) {
    return null;
  }

  return {
    round,
    slot,
    roundLabel: roundLabel(round, bracket.rounds),
    teamA,
    teamB,
    seedA: seedForTeam(seeds, teamA),
    seedB: seedForTeam(seeds, teamB),
    meetingProbability: 1,
    upsetProbability,
    upsetExpectation: upsetProbability,
    isKnownMatchup: true,
  };
}

function buildExpectedMatchupCandidates(
  bracket: Bracket,
  round: number,
  slot: number,
  seeds: Map<string, number>
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
      const upsetProbability = matchupUpsetProbability(teamA, teamB);
      if (upsetProbability === null) {
        continue;
      }

      const meetingProbability = reachA * reachB;
      candidates.push({
        round,
        slot,
        roundLabel: roundLabel(round, bracket.rounds),
        teamA,
        teamB,
        seedA: seedForTeam(seeds, teamA),
        seedB: seedForTeam(seeds, teamB),
        meetingProbability,
        upsetProbability,
        upsetExpectation: meetingProbability * upsetProbability,
        isKnownMatchup: false,
      });
    }
  }

  return candidates.sort((a, b) => b.upsetExpectation - a.upsetExpectation);
}

function summarizeRound(
  bracket: Bracket,
  round: number,
  seeds: Map<string, number>
): RoundUpsetSummary {
  const slots = Math.pow(2, bracket.rounds - round - 1);
  const candidates: UpsetCandidate[] = [];

  for (let slot = 0; slot < slots; slot++) {
    if (round === 0) {
      const candidate = buildKnownMatchupCandidate(bracket, round, slot, seeds);
      if (candidate) {
        candidates.push(candidate);
      }
    } else {
      candidates.push(
        ...buildExpectedMatchupCandidates(bracket, round, slot, seeds)
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
export function analyzeUpsetLandscape(teams: Team[]): UpsetLandscape {
  const bracket = createBracket(teams);
  const seeds = buildSeedMap(bracket.teams);
  const roundSummaries: RoundUpsetSummary[] = [];

  for (let round = 0; round < bracket.rounds; round++) {
    roundSummaries.push(summarizeRound(bracket, round, seeds));
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
