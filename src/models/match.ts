import type { BracketSlot } from "./game.js";
import type { Team } from "./team.js";

/** Bracket coordinates and identity shared by every live match. */
export interface MatchFrame extends BracketSlot {
  id: string;
}

/**
 * Live bracket match. Pending matches may have null teams or winner; completed
 * matches carry scores and a resolved winner (see {@link CompletedMatch}).
 */
export interface Match extends MatchFrame {
  teamA: Team | null;
  teamB: Team | null;
  winner: Team | null;
  scoreA?: number;
  scoreB?: number;
}

/** Both participants assigned but the contest has not been decided yet. */
export type ReadyMatch = Match & {
  teamA: Team;
  teamB: Team;
  winner: null;
};

/** A finished head-to-head with scores and a resolved winner object. */
export type CompletedMatch = Match & {
  teamA: Team;
  teamB: Team;
  winner: Team;
  scoreA: number;
  scoreB: number;
};

export interface Bracket {
  teams: Team[];
  matches: Match[];
  rounds: number;
}

export function matchBracketSlot(match: Match): BracketSlot {
  return { round: match.round, slot: match.slot };
}

/** Whether both teams are assigned and the match awaits a result. */
export function isReadyMatch(match: Match): match is ReadyMatch {
  return match.teamA != null && match.teamB != null && match.winner == null;
}

/** Whether a live match has been played through with scores and a winner. */
export function isCompletedMatch(match: Match): match is CompletedMatch {
  return (
    match.winner != null &&
    match.teamA != null &&
    match.teamB != null &&
    match.scoreA != null &&
    match.scoreB != null
  );
}
