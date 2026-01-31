import type { GameResult, RecordedGame } from "./game.js";
import {
  isCompletedMatch,
  type CompletedMatch,
  type Match,
} from "./match.js";
import type { Team } from "./team.js";

export { isCompletedMatch } from "./match.js";
export type { CompletedMatch, ReadyMatch } from "./match.js";

/** Scores and winner id shared by completed matches and recorded games. */
export type CompletedGameScores = Required<Pick<GameResult, "scoreA" | "scoreB">> & {
  winnerId: string;
};

export function gameResultFromMatch(match: Match): GameResult | undefined {
  if (!isCompletedMatch(match)) {
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

/** Collect every completed match in a bracket as persisted game records. */
export function recordedGamesFromBracket(
  matches: readonly Match[]
): RecordedGame[] {
  const games: RecordedGame[] = [];

  for (const match of matches) {
    const recorded = recordedGameFromMatch(match);
    if (recorded) {
      games.push(recorded);
    }
  }

  return games;
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
