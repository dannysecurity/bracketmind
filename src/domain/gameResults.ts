import type { Match, Team } from "../types.js";
import type { GameResult, RecordedGame } from "./types.js";

export function gameResultFromMatch(match: Match): GameResult | undefined {
  if (
    match.winner == null ||
    match.scoreA == null ||
    match.scoreB == null
  ) {
    return undefined;
  }

  return {
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    winnerId: match.winner.id,
  };
}

export function gameResultFromRecordedGame(game: RecordedGame): GameResult {
  return {
    scoreA: game.scoreA,
    scoreB: game.scoreB,
    winnerId: game.winnerId,
  };
}

export function recordedGameFromMatch(match: Match): RecordedGame | undefined {
  const result = gameResultFromMatch(match);
  if (!result || !match.teamA || !match.teamB) {
    return undefined;
  }

  return {
    round: match.round,
    slot: match.slot,
    teamAId: match.teamA.id,
    teamBId: match.teamB.id,
    ...result,
  };
}

/** Resolve the winning team object from a result and the two participants. */
export function resolveWinner(
  teamA: Team,
  teamB: Team,
  winnerId: string
): Team {
  if (winnerId === teamA.id) {
    return teamA;
  }
  if (winnerId === teamB.id) {
    return teamB;
  }

  throw new Error(
    `Winner id ${winnerId} does not match ${teamA.id} or ${teamB.id}`
  );
}

export function applyGameResultToMatch(
  match: Match,
  teamA: Team,
  teamB: Team,
  result: GameResult
): Team {
  const winner = resolveWinner(teamA, teamB, result.winnerId);
  match.scoreA = result.scoreA;
  match.scoreB = result.scoreB;
  match.winner = winner;
  return winner;
}
