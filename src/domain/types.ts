/** Bracket coordinates shared by live matches and persisted season games. */
export interface BracketSlot {
  round: number;
  slot: number;
}

/** Outcome of a head-to-head contest, independent of team object references. */
export interface GameResult {
  scoreA: number;
  scoreB: number;
  winnerId: string;
}

/** How teams are ordered before standard bracket placement. */
export type BracketOrdering = "rating" | "seed";

/** A recorded result at a bracket slot, referencing teams by id. */
export interface RecordedGame extends BracketSlot, GameResult {
  teamAId: string;
  teamBId: string;
}
