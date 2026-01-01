import { expectedScore } from "../ratings.js";
import type { Bracket, Match, SimulationResult, Team } from "../types.js";

/** Build a team for simulation tests. */
export function team(name: string, rating: number, id?: string): Team {
  return { id: id ?? name.toLowerCase().replace(/\s+/g, "-"), name, rating };
}

/** Return a deterministic RNG that cycles through the given values. */
export function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

/** Return an RNG that always yields the same value. */
export function constantRng(value: number): () => number {
  return () => value;
}

/** Win probability for team A from two ratings (Elo expected score). */
export function winProbabilityFor(ratingA: number, ratingB: number): number {
  return expectedScore(ratingA, ratingB);
}

/** Round-one pairings from a built bracket. */
export function roundOneMatches(bracket: Bracket): Match[] {
  return bracket.matches.filter((match) => match.round === 0);
}

/** Matches where one side is a BYE placeholder. */
export function byeMatches(bracket: Bracket): Match[] {
  return bracket.matches.filter(
    (match) => match.teamA?.name === "BYE" || match.teamB?.name === "BYE"
  );
}

/** Assert the recorded winner has the higher box score. */
export function assertWinnerHasHigherScore(
  result: SimulationResult,
  teamA: Team
): void {
  const winnerScore = result.winner.id === teamA.id ? result.scoreA : result.scoreB;
  const loserScore = result.winner.id === teamA.id ? result.scoreB : result.scoreA;
  if (winnerScore < loserScore) {
    throw new Error(
      `Winner ${result.winner.name} scored ${winnerScore}, loser scored ${loserScore}`
    );
  }
}

/** Assert every simulated non-BYE match has valid scores and a winner. */
export function assertBracketSimulationInvariants(bracket: Bracket): void {
  for (const match of bracket.matches) {
    const isBye =
      match.teamA?.name === "BYE" || match.teamB?.name === "BYE";

    if (isBye) {
      if (match.scoreA !== undefined || match.scoreB !== undefined) {
        throw new Error(`BYE match ${match.id} should not record scores`);
      }
      continue;
    }

    if (!match.winner) {
      throw new Error(`Match ${match.id} has no winner after simulation`);
    }

    if (match.scoreA === undefined || match.scoreB === undefined) {
      throw new Error(`Match ${match.id} is missing scores`);
    }

    const winnerScore =
      match.winner.id === match.teamA?.id ? match.scoreA : match.scoreB;
    const loserScore =
      match.winner.id === match.teamA?.id ? match.scoreB : match.scoreA;

    if (winnerScore <= loserScore) {
      throw new Error(`Match ${match.id} winner did not outscore the loser`);
    }
  }
}
