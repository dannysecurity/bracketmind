import type { BracketSlot } from "./game.js";
import type { Team } from "./team.js";

export interface Match extends BracketSlot {
  id: string;
  teamA: Team | null;
  teamB: Team | null;
  winner: Team | null;
  scoreA?: number;
  scoreB?: number;
}

export interface Bracket {
  teams: Team[];
  matches: Match[];
  rounds: number;
}

export function matchBracketSlot(match: Match): BracketSlot {
  return { round: match.round, slot: match.slot };
}
