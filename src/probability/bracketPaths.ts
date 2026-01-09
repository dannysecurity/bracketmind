import { expectedScore } from "../ratings.js";
import type { Bracket, Team } from "../types.js";

export type WinDistribution = Map<string, number>;

function matchIndex(round: number, slot: number, rounds: number): number {
  let index = 0;
  for (let r = 0; r < round; r++) {
    index += Math.pow(2, rounds - r - 1);
  }
  return index + slot;
}

function teamById(teams: Team[], id: string): Team {
  const team = teams.find((entry) => entry.id === id);
  if (!team) {
    throw new Error(`Unknown team id: ${id}`);
  }
  return team;
}

function leafDistribution(teamA: Team, teamB: Team): WinDistribution {
  if (teamA.name === "BYE") {
    return new Map([[teamB.id, 1]]);
  }
  if (teamB.name === "BYE") {
    return new Map([[teamA.id, 1]]);
  }

  const probA = expectedScore(teamA.rating, teamB.rating);
  return new Map([
    [teamA.id, probA],
    [teamB.id, 1 - probA],
  ]);
}

/** Probability each team wins the subtree rooted at a bracket match. */
export function computeSubtreeDistribution(
  bracket: Bracket,
  round: number,
  slot: number
): WinDistribution {
  const match = bracket.matches[matchIndex(round, slot, bracket.rounds)];

  if (match.round === 0) {
    return leafDistribution(match.teamA!, match.teamB!);
  }

  const leftDist = computeSubtreeDistribution(
    bracket,
    round - 1,
    slot * 2
  );
  const rightDist = computeSubtreeDistribution(
    bracket,
    round - 1,
    slot * 2 + 1
  );
  const result: WinDistribution = new Map();

  for (const [idA, reachA] of leftDist) {
    for (const [idB, reachB] of rightDist) {
      const teamA = teamById(bracket.teams, idA);
      const teamB = teamById(bracket.teams, idB);
      const probA = expectedScore(teamA.rating, teamB.rating);
      const meetProb = reachA * reachB;

      result.set(idA, (result.get(idA) ?? 0) + meetProb * probA);
      result.set(idB, (result.get(idB) ?? 0) + meetProb * (1 - probA));
    }
  }

  return result;
}

/** Analytical championship probabilities assuming fixed pre-tournament ratings. */
export function computeChampionshipProbabilities(
  bracket: Bracket
): WinDistribution {
  if (bracket.rounds === 0) {
    return new Map();
  }

  return computeSubtreeDistribution(bracket, bracket.rounds - 1, 0);
}
