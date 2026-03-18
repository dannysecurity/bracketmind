import type { TeamId } from "./team.js";

/** Bracket coordinates shared by live matches and persisted season games. */
export interface BracketSlot {
  round: number;
  slot: number;
}

/** Head-to-head participants referenced by stable team ids. */
export interface GameParticipants {
  teamAId: TeamId;
  teamBId: TeamId;
}

/** Outcome of a head-to-head contest, independent of team object references. */
export interface GameResult {
  scoreA: number;
  scoreB: number;
  winnerId: TeamId;
}

/** A recorded result at a bracket slot, referencing teams by id. */
export interface RecordedGame extends BracketSlot, GameParticipants, GameResult {}

/** Canonical string key for indexing games and matches by bracket position. */
export function bracketSlotKey(slot: BracketSlot): string {
  return `${slot.round}:${slot.slot}`;
}

export function sameBracketSlot(a: BracketSlot, b: BracketSlot): boolean {
  return a.round === b.round && a.slot === b.slot;
}

/** Extract bracket coordinates from any object that carries round and slot. */
export function bracketSlotOf(value: BracketSlot): BracketSlot {
  return { round: value.round, slot: value.slot };
}

/** Extract participant ids from any object that carries teamAId and teamBId. */
export function gameParticipantsOf(value: GameParticipants): GameParticipants {
  return { teamAId: value.teamAId, teamBId: value.teamBId };
}

/** Whether the recorded winner is team A in a head-to-head result. */
export function isWinnerTeamA(game: GameParticipants & GameResult): boolean {
  return game.winnerId === game.teamAId;
}

/** Winner and loser scores aligned with the declared winner id. */
export function winnerAndLoserScores(
  game: GameParticipants & GameResult
): { winnerScore: number; loserScore: number } {
  return isWinnerTeamA(game)
    ? { winnerScore: game.scoreA, loserScore: game.scoreB }
    : { winnerScore: game.scoreB, loserScore: game.scoreA };
}

/**
 * Validate scores and winner id for a head-to-head result.
 * Optional context is appended to error messages (e.g. bracket coordinates).
 */
/** Ensure a head-to-head references two different teams. */
export function validateGameParticipants(
  participants: GameParticipants,
  context?: string
): void {
  const suffix = context ? ` in ${context}` : "";

  if (participants.teamAId === participants.teamBId) {
    throw new Error(`teamA and teamB must be different${suffix}`);
  }
}

export function validateGameResult(
  result: GameResult,
  participants: GameParticipants,
  context?: string
): void {
  const suffix = context ? ` in ${context}` : "";

  validateGameParticipants(participants, context);

  if (result.scoreA < 0 || result.scoreB < 0) {
    throw new Error(`Scores must be non-negative${suffix}`);
  }

  if (
    result.winnerId !== participants.teamAId &&
    result.winnerId !== participants.teamBId
  ) {
    throw new Error(
      `Winner "${result.winnerId}" must be teamA or teamB${suffix}`
    );
  }

  const { winnerScore, loserScore } = winnerAndLoserScores({
    ...participants,
    ...result,
  });

  if (winnerScore <= loserScore) {
    throw new Error(`Winner must outscore the loser${suffix}`);
  }
}
