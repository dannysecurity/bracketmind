import type { TeamId } from "./team.js";

/** Bracket coordinates shared by live matches and persisted season games. */
export interface BracketSlot {
  round: number;
  slot: number;
}

/** Outcome of a head-to-head contest, independent of team object references. */
export interface GameResult {
  scoreA: number;
  scoreB: number;
  winnerId: TeamId;
}

/** A recorded result at a bracket slot, referencing teams by id. */
export interface RecordedGame extends BracketSlot, GameResult {
  teamAId: TeamId;
  teamBId: TeamId;
}

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
